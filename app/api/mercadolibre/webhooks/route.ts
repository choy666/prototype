import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mercadolibreWebhooks, mercadolibreProductsSync, mercadolibreQuestions } from '@/lib/schema';
import { eq, and, count } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import crypto from 'crypto';

interface MercadoLibreWebhookPayload {
  application_id: string;
  user_id: string;
  topic: string;
  resource: string;
  attempts: number;
  sent: string;
  received: string;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.text();
    const payload: MercadoLibreWebhookPayload = JSON.parse(body);

    logger.info('Webhook de Mercado Libre recibido', {
      topic: payload.topic,
      resource: payload.resource,
      userId: payload.user_id,
      applicationId: payload.application_id,
      attempts: payload.attempts,
    });

    // Validar aplicación
    const appId = process.env.MERCADOLIBRE_CLIENT_ID;
    if (payload.application_id !== appId) {
      logger.error('Webhook de aplicación no válida', {
        receivedAppId: payload.application_id,
        expectedAppId: appId,
      });
      return NextResponse.json({ error: 'Aplicación no válida' }, { status: 401 });
    }

    // Generar ID único para el webhook
    const webhookId = crypto.randomUUID();

    // Guardar webhook en base de datos
    const webhookRecord = await db.insert(mercadolibreWebhooks).values({
      webhookId,
      topic: payload.topic,
      resource: payload.resource,
      userId: parseInt(payload.user_id),
      resourceId: payload.resource.split('/').pop() || null,
      applicationId: payload.application_id,
      payload: payload,
      retryCount: payload.attempts || 0,
      createdAt: new Date(),
    }).returning();

    // Procesar el webhook según el topic
    const processingResult = await processWebhookNotification(
      payload.topic,
      payload.resource
    );

    // Actualizar estado del webhook
    await db.update(mercadolibreWebhooks)
      .set({
        processed: processingResult.success,
        processedAt: new Date(),
        errorMessage: processingResult.error || null,
      })
      .where(eq(mercadolibreWebhooks.id, webhookRecord[0].id));

    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.info('Webhook de Mercado Libre procesado', {
      webhookId,
      topic: payload.topic,
      success: processingResult.success,
      duration: `${duration}ms`,
    });

    if (processingResult.success) {
      return NextResponse.json({ 
        success: true,
        webhookId,
        processed: true,
      });
    } else {
      return NextResponse.json({ 
        success: false,
        error: processingResult.error,
        webhookId,
      }, { status: 500 });
    }

  } catch (error) {
    logger.error('Error procesando webhook de Mercado Libre', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { 
        success: false,
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
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

    const whereCondition = whereConditions.length > 0 
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
      orderBy: (mercadolibreWebhooks, { desc }) => [
        desc(mercadolibreWebhooks.createdAt),
      ],
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

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función principal de procesamiento de webhooks
async function processWebhookNotification(
  topic: string,
  resource: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // El payload se recibe pero no se utiliza directamente en este handler
    switch (topic) {
      case 'items':
        return await handleItemsWebhook(resource);
      
      case 'orders':
        return await handleOrdersWebhook(resource);
      
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

// Handlers específicos por topic
async function handleItemsWebhook(
  resource: string
): Promise<{ success: boolean; error?: string }> {
  const itemId = resource.split('/').pop();
  
  if (!itemId) {
    return { success: false, error: 'ID de item no válido' };
  }

  try {
    // Actualizar estado de sincronización del producto
    const syncRecord = await db.query.mercadolibreProductsSync.findFirst({
      where: eq(mercadolibreProductsSync.mlItemId, itemId),
    });

    if (syncRecord) {
      await db.update(mercadolibreProductsSync)
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

async function handleOrdersWebhook(
  resource: string
): Promise<{ success: boolean; error?: string }> {
  const orderId = resource.split('/').pop();
  
  if (!orderId) {
    return { success: false, error: 'ID de orden no válido' };
  }

  try {
    // Aquí podrías disparar la importación automática de la orden
    // o actualizar su estado si ya existe
    
    logger.info('Webhook de orden recibido', {
      orderId,
    });

    // Por ahora solo registramos el evento
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
