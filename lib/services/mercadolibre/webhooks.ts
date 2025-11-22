import { db } from '@/lib/db';
import { mercadolibreWebhooks, products, orders, orderStatusEnum } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

interface WebhookPayload {
  item_id?: string;
  order_id?: string;
  status?: string;
  [key: string]: unknown;
}

export async function processMercadoLibreWebhook(webhookId: number) {
  try {
    // Obtener webhook de BD
    const webhook = await db.query.mercadolibreWebhooks.findFirst({
      where: eq(mercadolibreWebhooks.id, webhookId),
    });

    if (!webhook) {
      throw new Error(`Webhook ${webhookId} no encontrado`);
    }

    if (webhook.processed) {
      logger.info(`Webhook ${webhookId} ya procesado`);
      return;
    }

    const { topic, resource, payload } = webhook;

    // Convertir payload unknown a WebhookPayload de forma segura
    const webhookPayload = payload as WebhookPayload;

    logger.info('Procesando webhook ML', {
      webhookId,
      topic,
      resource,
      payload: webhookPayload
    });

    // Procesar según el tipo de webhook
    switch (topic) {
      case 'items':
        await handleItemWebhook(webhookPayload);
        break;
      case 'orders':
        await handleOrderWebhook(webhookPayload);
        break;
      case 'questions':
        await handleQuestionWebhook(webhookPayload);
        break;
      case 'claims':
        await handleClaimWebhook(webhookPayload);
        break;
      default:
        logger.warn('Tipo de webhook no manejado', { topic });
    }

    // Marcar como procesado
    await db.update(mercadolibreWebhooks)
      .set({
        processed: true,
        processedAt: new Date(),
      })
      .where(eq(mercadolibreWebhooks.id, webhookId));

    logger.info('Webhook procesado exitosamente', { webhookId });

  } catch (error) {
    logger.error('Error procesando webhook', {
      webhookId,
      error: error instanceof Error ? error.message : String(error)
    });

    // Actualizar con error
    await db.update(mercadolibreWebhooks)
      .set({
        errorMessage: error instanceof Error ? error.message : String(error),
        retryCount: sql`${mercadolibreWebhooks.retryCount} + 1`,
      })
      .where(eq(mercadolibreWebhooks.id, webhookId));

    throw error;
  }
}

async function handleItemWebhook(payload: WebhookPayload) {
  const { item_id, status } = payload;

  if (!item_id) return;

  // Actualizar estado del producto local
  const product = await db.query.products.findFirst({
    where: eq(products.mlItemId, item_id.toString()),
  });

  if (product) {
    await db.update(products)
      .set({
        mlSyncStatus: status === 'active' ? 'synced' : 'error',
        updated_at: new Date(),
      })
      .where(eq(products.id, product.id));

    logger.info('Producto actualizado desde webhook', {
      productId: product.id,
      mlItemId: item_id,
      status
    });
  }
}

async function handleOrderWebhook(payload: WebhookPayload) {
  const { order_id, status } = payload;

  if (!order_id) return;

  // Actualizar estado de orden local
  const order = await db.query.orders.findFirst({
    where: eq(orders.mlOrderId, order_id.toString()),
  });

  if (order) {
    await db.update(orders)
      .set({
        status: mapMLStatusToLocal(status) as typeof orderStatusEnum.enumValues[0],
        mlStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    logger.info('Orden actualizada desde webhook', {
      orderId: order.id,
      mlOrderId: order_id,
      status
    });
  }
}

async function handleQuestionWebhook(payload: WebhookPayload) {
  // Implementar manejo de preguntas
  logger.info('Pregunta recibida', payload);
}

async function handleClaimWebhook(payload: WebhookPayload) {
  // Implementar manejo de reclamos
  logger.info('Reclamo recibido', payload);
}

function mapMLStatusToLocal(mlStatus: string | undefined): string {
  if (!mlStatus) return 'pending';
  
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'paid': 'paid',
    'cancelled': 'cancelled',
    'confirmed': 'paid',
    'payment_required': 'pending',
    'payment_in_process': 'pending',
    'partially_paid': 'paid',
    'rejected': 'rejected',
    'refunded': 'cancelled',
    'in_mediation': 'pending',
    'invalid': 'rejected',
  };

  return statusMap[mlStatus] || 'pending';
}
