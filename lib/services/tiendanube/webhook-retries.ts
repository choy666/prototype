import { db } from '@/lib/db';
import { tiendanubeWebhooksRaw } from '@/lib/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

interface WebhookRetryResult {
  processed: number;
  failed: number;
  deadLetter: number;
}

export class WebhookRetryService {
  private static readonly BASE_DELAY_MS = 60 * 1000; // 60 segundos base
  private static readonly MAX_RETRIES = 5;

  /**
   * Calcula el próximo tiempo de retry usando backoff exponencial
   */
  private static calculateNextRetry(retryCount: number): Date {
    const delayMs = this.BASE_DELAY_MS * Math.pow(2, retryCount);
    const maxDelayMs = 30 * 60 * 1000; // Máximo 30 minutos
    const finalDelayMs = Math.min(delayMs, maxDelayMs);
    return new Date(Date.now() + finalDelayMs);
  }

  /**
   * Marca un webhook para retry
   */
  static async scheduleRetry(
    webhookId: number,
    error: string
  ): Promise<void> {
    const webhook = await db.query.tiendanubeWebhooksRaw.findFirst({
      where: eq(tiendanubeWebhooksRaw.id, webhookId),
    });

    if (!webhook) {
      logger.error('Webhook no encontrado para scheduleRetry', { webhookId });
      return;
    }

    const newRetryCount = webhook.retryCount + 1;

    if (newRetryCount >= this.MAX_RETRIES) {
      // Marcar como dead_letter
      await db
        .update(tiendanubeWebhooksRaw)
        .set({
          status: 'dead_letter',
          errorMessage: error,
          updatedAt: new Date(),
        })
        .where(eq(tiendanubeWebhooksRaw.id, webhookId));

      logger.error('Webhook enviado a dead_letter', {
        webhookId,
        event: webhook.event,
        storeId: webhook.storeId,
        retryCount: newRetryCount,
        error,
      });
    } else {
      // Programar próximo retry
      const nextRetryAt = this.calculateNextRetry(webhook.retryCount);

      await db
        .update(tiendanubeWebhooksRaw)
        .set({
          status: 'retrying',
          retryCount: newRetryCount,
          lastRetryAt: new Date(),
          nextRetryAt,
          errorMessage: error,
          updatedAt: new Date(),
        })
        .where(eq(tiendanubeWebhooksRaw.id, webhookId));

      logger.info('Webhook programado para retry', {
        webhookId,
        event: webhook.event,
        storeId: webhook.storeId,
        retryCount: newRetryCount,
        nextRetryAt,
      });
    }
  }

  /**
   * Procesa webhooks pendientes de retry
   */
  static async processRetries(): Promise<WebhookRetryResult> {
    const now = new Date();
    
    // Obtener webhooks que necesitan retry
    const pendingRetries = await db.query.tiendanubeWebhooksRaw.findMany({
      where: and(
        eq(tiendanubeWebhooksRaw.status, 'retrying'),
        lt(tiendanubeWebhooksRaw.nextRetryAt, now),
        sql`${tiendanubeWebhooksRaw.retryCount} < ${this.MAX_RETRIES}`
      ),
      limit: 50, // Limitar para no sobrecargar
    });

    const result: WebhookRetryResult = {
      processed: 0,
      failed: 0,
      deadLetter: 0,
    };

    for (const webhook of pendingRetries) {
      try {
        // Re-procesar el webhook llamando al endpoint interno
        const headers = typeof webhook.headers === 'object' && webhook.headers !== null 
          ? webhook.headers as Record<string, string>
          : {};
        
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tiendanube/webhooks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-retry': 'true',
            ...headers,
          },
          body: webhook.rawBody,
        });

        if (response.ok) {
          // Marcar como procesado exitosamente
          await db
            .update(tiendanubeWebhooksRaw)
            .set({
              status: 'processed',
              processed: true,
              errorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(tiendanubeWebhooksRaw.id, webhook.id));

          result.processed++;
          logger.info('Webhook reprocesado exitosamente', {
            webhookId: webhook.id,
            event: webhook.event,
            storeId: webhook.storeId,
            retryCount: webhook.retryCount,
          });
        } else {
          const errorText = await response.text();
          await this.scheduleRetry(webhook.id, `Retry failed: ${response.status} ${errorText}`);
          result.failed++;
        }
      } catch (error) {
        await this.scheduleRetry(
          webhook.id,
          error instanceof Error ? error.message : String(error)
        );
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Limpia webhooks antiguos procesados (mantener solo 30 días)
   */
  static async cleanupOldWebhooks(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedCount = await db
      .delete(tiendanubeWebhooksRaw)
      .where(
        and(
          eq(tiendanubeWebhooksRaw.processed, true),
          lt(tiendanubeWebhooksRaw.createdAt, thirtyDaysAgo)
        )
      );

    const deleted = Number(deletedCount);
    if (deleted > 0) {
      logger.info('Webhooks antiguos limpiados', { deleted });
    }

    return deleted;
  }

  /**
   * Obtiene estadísticas de webhooks para monitoreo
   */
  static async getWebhookStats(storeId?: string) {
    const conditions = storeId 
      ? eq(tiendanubeWebhooksRaw.storeId, storeId)
      : sql`1=1`;

    const stats = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`count(*) FILTER (WHERE status = 'pending')`,
        retrying: sql<number>`count(*) FILTER (WHERE status = 'retrying')`,
        processed: sql<number>`count(*) FILTER (WHERE processed = true)`,
        deadLetter: sql<number>`count(*) FILTER (WHERE status = 'dead_letter')`,
      })
      .from(tiendanubeWebhooksRaw)
      .where(conditions);

    return stats[0];
  }
}

/**
 * Endpoint para ejecutar retries manualmente (para admin/debug)
 */
export async function triggerWebhookRetries(storeId?: string): Promise<WebhookRetryResult> {
  logger.info('Iniciando procesamiento de retries de webhooks', { storeId });
  
  const result = await WebhookRetryService.processRetries();
  
  logger.info('Procesamiento de retries completado', result);
  
  return result;
}
