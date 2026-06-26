// lib/actions/webhook-failures.ts

import { db } from '@/lib/db';
import { webhookFailures } from '@/lib/schema';
import { logger } from '@/lib/utils/logger';
import { eq, and } from 'drizzle-orm';

export interface FailedWebhookData {
  paymentId: string;
  requestId: string;
  rawBody: string;
  headers: Record<string, string>;
  errorMessage: string;
  clientIp?: string;
  retryCount?: number;
}

export async function saveFailedWebhookForRetry(data: FailedWebhookData) {
  try {
    logger.info('Guardando webhook fallido para retry', {
      requestId: data.requestId,
      paymentId: data.paymentId,
      errorMessage: data.errorMessage,
    });

    // Calcular próximo retry (exponential backoff: 5min, 15min, 45min, 2h, 6h)
    const retryDelayMinutes = Math.min(5 * Math.pow(3, data.retryCount || 0), 360); // Max 6 horas
    const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

    await db.insert(webhookFailures).values({
      paymentId: data.paymentId,
      requestId: data.requestId,
      rawBody: JSON.parse(data.rawBody),
      headers: data.headers,
      errorMessage: data.errorMessage,
      clientIp: data.clientIp,
      retryCount: data.retryCount || 0,
      status: 'retrying',
      nextRetryAt,
      lastRetryAt: new Date(),
    });

    logger.info('Webhook guardado exitosamente', {
      requestId: data.requestId,
      nextRetryAt: nextRetryAt.toISOString(),
      retryCount: data.retryCount || 0,
    });

    return { success: true, nextRetryAt };
  } catch (error) {
    logger.error('Error guardando webhook para retry', {
      requestId: data.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function saveDeadLetterWebhook(data: FailedWebhookData) {
  try {
    logger.error('Enviando webhook a dead letter', {
      requestId: data.requestId,
      paymentId: data.paymentId,
      errorMessage: data.errorMessage,
    });

    await db.insert(webhookFailures).values({
      paymentId: data.paymentId,
      requestId: data.requestId,
      rawBody: JSON.parse(data.rawBody),
      headers: data.headers,
      errorMessage: data.errorMessage,
      clientIp: data.clientIp,
      retryCount: data.retryCount || 0,
      status: 'dead_letter',
    });

    logger.warn('Webhook marcado como dead letter', {
      requestId: data.requestId,
      paymentId: data.paymentId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error guardando webhook en dead letter', {
      requestId: data.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function getFailedWebhooks(filters?: {
  status?: string;
  paymentId?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    let query = db.select().from(webhookFailures);

    // Aplicar filtros dinámicamente
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(webhookFailures.status, filters.status as 'failed' | 'retrying' | 'success' | 'dead_letter'));
    }
    if (filters?.paymentId) {
      conditions.push(eq(webhookFailures.paymentId, filters.paymentId));
    }

    // Aplicar condiciones con where
    if (conditions.length > 0) {
      // @ts-expect-error - Drizzle query builder types don't infer well with conditional building
      query = query.where(and(...conditions));
    }

    // Aplicar paginación
    if (filters?.limit) {
      // @ts-expect-error - Drizzle query builder types don't infer well with conditional building
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      // @ts-expect-error - Drizzle query builder types don't infer well with conditional building
      query = query.offset(filters.offset);
    }

    // Ejecutar query con ordenamiento
    const webhooks = await query.orderBy(webhookFailures.createdAt);
    return webhooks;
  } catch (error) {
    logger.error('Error obteniendo webhooks fallidos', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function retryWebhook(id: number) {
  try {
    const webhook = await db.select().from(webhookFailures).where(eq(webhookFailures.id, id)).limit(1);
    
    if (!webhook.length) {
      throw new Error('Webhook no encontrado');
    }

    const webhookData = webhook[0];
    
    logger.info('Reintentando webhook manualmente', {
      id,
      requestId: webhookData.requestId,
      paymentId: webhookData.paymentId,
    });

    // Actualizar estado a retrying
    await db
      .update(webhookFailures)
      .set({
        status: 'retrying',
        lastRetryAt: new Date(),
        nextRetryAt: new Date(), // Retry inmediato
        retryCount: webhookData.retryCount + 1,
      })
      .where(eq(webhookFailures.id, id));

    // Reenviar al endpoint de procesamiento
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   process.env.APP_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const notifyUrl = `${baseUrl}/api/mercadopago/payments/notify`;

    const response = await fetch(notifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookData.rawBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Retry failed: ${response.status} ${errorText}`);
    }

    // Marcar como exitoso
    await db
      .update(webhookFailures)
      .set({
        status: 'success',
        processedAt: new Date(),
      })
      .where(eq(webhookFailures.id, id));

    logger.info('Webhook reintentado exitosamente', {
      id,
      requestId: webhookData.requestId,
    });

    return { success: true, status: 'success' };
  } catch (error) {
    logger.error('Error reintentando webhook', {
      id,
      error: error instanceof Error ? error.message : String(error),
    });

    // Marcar como failed si el retry falló
    await db
      .update(webhookFailures)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(eq(webhookFailures.id, id));

    throw error;
  }
}
