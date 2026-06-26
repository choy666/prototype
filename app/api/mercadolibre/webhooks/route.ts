import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  mercadolibreWebhooks,
  mercadolibreProductsSync,
  mercadolibreQuestions,
  users,
  webhookReplayCache,
} from '@/lib/schema';
import { eq, and, count, lt } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import crypto from 'crypto';
import { auth } from '@/lib/actions/auth';
import { importMercadoLibreOrderById } from '@/lib/services/mercadolibre/orders-import';
import { WEBHOOK_CONFIG } from '@/lib/config/integrations';
import { verifyMercadoLibreWebhookSignature } from '@/lib/mercadolibre/webhook-security';
import { processShipmentWebhook } from '@/lib/services/mercadolibre/shipment-processor';
import { saveDeadLetterWebhook, saveFailedWebhookForRetry } from '@/lib/actions/webhook-failures';

interface MercadoLibreWebhookPayload {
  application_id: string;
  user_id: string;
  topic: string;
  resource: string;
  attempts: number;
  sent: string;
  received: string;
}

async function handleItemsWebhook(resource: string): Promise<{ success: boolean; error?: string }> {
  const itemId = resource.split('/').pop();

  if (!itemId) {
    return { success: false, error: 'ID de item no válido' };
  }

  try {
    const syncRecord = await db.query.mercadolibreProductsSync.findFirst({
      where: eq(mercadolibreProductsSync.mlItemId, itemId),
    });

    if (syncRecord) {
      await db
        .update(mercadolibreProductsSync)
        .set({
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mercadolibreProductsSync.id, syncRecord.id));

      logger.info('Sincronización de producto actualizada por webhook', {
        itemId,
        syncId: syncRecord.id,
      });
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkReplayGuard(
  requestId: string
): Promise<{ isReplay: boolean; expiresAt?: Date }> {
  const now = new Date();

  try {
    await db.delete(webhookReplayCache).where(lt(webhookReplayCache.expiresAt, now));
  } catch (error) {
    logger.warn('[ML Webhook] No se pudo limpiar el replay cache', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const existing = await db
    .select({
      requestId: webhookReplayCache.requestId,
      expiresAt: webhookReplayCache.expiresAt,
    })
    .from(webhookReplayCache)
    .where(eq(webhookReplayCache.requestId, requestId))
    .limit(1);

  if (existing.length > 0) {
    return { isReplay: true, expiresAt: existing[0].expiresAt ?? undefined };
  }

  const expiresAt = new Date(now.getTime() + WEBHOOK_CONFIG.replayCacheTtlMs);

  await db.insert(webhookReplayCache).values({
    requestId,
    createdAt: now,
    expiresAt,
  });

  return { isReplay: false };
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const rawBody = await req.text();
    const headersObject = Object.fromEntries(req.headers.entries());
    const signatureHeader = req.headers.get(WEBHOOK_CONFIG.signatureHeader);
    const requestIdHeader = req.headers.get(WEBHOOK_CONFIG.requestIdHeader) ?? crypto.randomUUID();

    if (!verifyMercadoLibreWebhookSignature(rawBody, signatureHeader)) {
      logger.warn('[ML Webhook] Firma inválida detectada', {
        requestId: requestIdHeader,
      });

      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
    }

    const replayEntry = await checkReplayGuard(requestIdHeader);
    if (replayEntry.isReplay) {
      logger.info('[ML Webhook] Notificación duplicada ignorada', {
        requestId: requestIdHeader,
        expiresAt: replayEntry.expiresAt?.toISOString(),
      });

      return NextResponse.json({ success: true, replay: true });
    }

    const payload: MercadoLibreWebhookPayload = JSON.parse(rawBody);

    logger.info('[ML Webhook] Notificación recibida', {
      topic: payload.topic,
      resource: payload.resource,
      userId: payload.user_id,
      applicationId: payload.application_id,
      attempts: payload.attempts,
      requestId: requestIdHeader,
    });

    const appId = process.env.MERCADOLIBRE_CLIENT_ID;
    if (payload.application_id !== appId) {
      logger.error('[ML Webhook] Aplicación no válida', {
        receivedAppId: payload.application_id,
        expectedAppId: appId,
      });
      return NextResponse.json({ error: 'Aplicación no válida' }, { status: 401 });
    }

    const localUser = await db.query.users.findFirst({
      where: eq(users.mercadoLibreId, payload.user_id),
      columns: {
        id: true,
      },
    });

    const webhookId = crypto.randomUUID();
    const now = new Date();

    const webhookRecord = await db
      .insert(mercadolibreWebhooks)
      .values({
        webhookId,
        topic: payload.topic,
        resource: payload.resource,
        userId: localUser?.id ?? null,
        resourceId: payload.resource.split('/').pop() || null,
        applicationId: payload.application_id,
        payload,
        headers: headersObject,
        rawPayload: rawBody,
        requestId: requestIdHeader,
        signature: signatureHeader,
        retryCount: payload.attempts || 0,
        status: 'retrying',
        createdAt: now,
      })
      .returning();

    const processingResult = await processWebhookNotification(
      payload.topic,
      payload.resource,
      localUser?.id ?? null
    );

    if (processingResult.success) {
      await db
        .update(mercadolibreWebhooks)
        .set({
          processed: true,
          processedAt: new Date(),
          status: 'success',
          errorMessage: null,
        })
        .where(eq(mercadolibreWebhooks.id, webhookRecord[0].id));

      const endTime = Date.now();
      logger.info('[ML Webhook] Procesado correctamente', {
        webhookId,
        topic: payload.topic,
        duration: `${endTime - startTime}ms`,
      });

      return NextResponse.json({
        success: true,
        webhookId,
        processed: true,
      });
    }

    const updatedRetryCount = (webhookRecord[0].retryCount ?? 0) + 1;
    const reachedMax = updatedRetryCount >= WEBHOOK_CONFIG.maxRetries;

    await db
      .update(mercadolibreWebhooks)
      .set({
        processed: false,
        processedAt: new Date(),
        status: reachedMax ? 'dead_letter' : 'retrying',
        errorMessage: processingResult.error || 'Error desconocido',
        retryCount: updatedRetryCount,
      })
      .where(eq(mercadolibreWebhooks.id, webhookRecord[0].id));

    const failurePayload = {
      paymentId: payload.resource,
      requestId: requestIdHeader,
      rawBody,
      headers: headersObject,
      errorMessage: processingResult.error || 'Error procesando webhook de Mercado Libre',
      clientIp: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
      retryCount: updatedRetryCount,
    };

    if (reachedMax) {
      await saveDeadLetterWebhook(failurePayload);
    } else {
      await saveFailedWebhookForRetry(failurePayload);
    }

    logger.error('[ML Webhook] Error procesando notificación', {
      webhookId,
      topic: payload.topic,
      error: processingResult.error,
      retryCount: updatedRetryCount,
    });

    return NextResponse.json(
      {
        success: false,
        error: processingResult.error,
        webhookId,
      },
      { status: reachedMax ? 410 : 500 }
    );
  } catch (error) {
    logger.error('[ML Webhook] Error inesperado', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic');
    const processed = searchParams.get('processed');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Construir condiciones de filtro
    const whereConditions = [];

    if (topic) {
      whereConditions.push(eq(mercadolibreWebhooks.topic, topic));
    }

    if (processed !== null) {
      whereConditions.push(eq(mercadolibreWebhooks.processed, processed === 'true'));
    }

    const whereCondition =
      whereConditions.length > 0
        ? whereConditions.length === 1
          ? whereConditions[0]
          : and(...whereConditions)
        : undefined;

    // Obtener webhooks
    const webhooks = await db.query.mercadolibreWebhooks.findMany({
      where: whereCondition,
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      limit,
      offset,
      orderBy: (mercadolibreWebhooks, { desc }) => [desc(mercadolibreWebhooks.createdAt)],
    });

    // Obtener estadísticas
    const stats = await db
      .select({
        topic: mercadolibreWebhooks.topic,
        processed: mercadolibreWebhooks.processed,
        count: count(mercadolibreWebhooks.id),
      })
      .from(mercadolibreWebhooks)
      .groupBy(mercadolibreWebhooks.topic, mercadolibreWebhooks.processed);

    return NextResponse.json({
      webhooks,
      stats,
      pagination: {
        limit,
        offset,
        total: webhooks.length,
      },
    });
  } catch (error) {
    logger.error('Error obteniendo webhooks', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Función principal de procesamiento de webhooks
async function processWebhookNotification(
  topic: string,
  resource: string,
  localUserId: number | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // El payload se recibe pero no se utiliza directamente en este handler
    switch (topic) {
      case 'items':
        return await handleItemsWebhook(resource);

      case 'orders':
        return await handleOrdersWebhook(resource, localUserId);

      case 'shipments':
        return await processShipmentWebhook(resource);

      case 'questions':
        return await handleQuestionsWebhook(resource);

      case 'payments':
        return await handlePaymentsWebhook(resource);

      default:
        logger.warn('Topic de webhook no soportado', { topic, resource });
        return { success: true }; // No es error, solo no se procesa
    }
  } catch (error) {
    logger.error('Error procesando webhook', {
      topic,
      resource,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleOrdersWebhook(
  resource: string,
  localUserId: number | null
): Promise<{ success: boolean; error?: string }> {
  const orderId = resource.split('/').pop();

  if (!orderId) {
    return { success: false, error: 'ID de orden no válido' };
  }

  try {
    if (!localUserId) {
      return {
        success: false,
        error: 'No se pudo resolver el usuario local para importar la orden',
      };
    }

    await importMercadoLibreOrderById({
      localUserId,
      mlOrderId: orderId,
    });

    logger.info('Webhook de orden recibido', {
      orderId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleQuestionsWebhook(
  resource: string
): Promise<{ success: boolean; error?: string }> {
  const questionId = resource.split('/').pop();

  if (!questionId) {
    return { success: false, error: 'ID de pregunta no válido' };
  }

  try {
    // Verificar si la pregunta ya existe localmente
    const existingQuestion = await db.query.mercadolibreQuestions.findFirst({
      where: eq(mercadolibreQuestions.mlQuestionId, questionId),
    });

    if (!existingQuestion) {
      // Disparar sincronización de esta pregunta específica
      logger.info('Nueva pregunta detectada, sincronizando', {
        questionId,
      });

      // Aquí podrías llamar a una función de sincronización
      // Por ahora solo registramos el evento
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handlePaymentsWebhook(
  resource: string
): Promise<{ success: boolean; error?: string }> {
  const paymentId = resource.split('/').pop();

  if (!paymentId) {
    return { success: false, error: 'ID de pago no válido' };
  }

  try {
    // Los pagos de ML generalmente se manejan a través de Mercado Pago
    // pero registramos el evento por si se necesita algún procesamiento

    logger.info('Webhook de pago ML recibido', {
      paymentId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
