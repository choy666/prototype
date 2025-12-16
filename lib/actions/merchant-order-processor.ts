import { db } from '@/lib/db';
import { orders } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { retryWithBackoff } from '@/lib/utils/retry';

interface MPMerchantOrderShipment {
  id?: number | string;
  shipping_mode?: string;
  status?: string;
  shipping_option?: unknown;
  receiver_address?: unknown;
}

async function fetchMerchantOrderUntilHasShipment(
  merchantOrderId: string
): Promise<MPMerchantOrder> {
  return retryWithBackoff(
    async () => {
      const mo = await fetchMerchantOrder(merchantOrderId);
      const shipment = (mo.shipments ?? []).find((s) => s?.shipping_mode === 'me2') ?? (mo.shipments ?? [])[0];
      const shipmentId = shipment?.id != null ? String(shipment.id) : null;

      if (!shipmentId) {
        throw new Error('shipment_not_ready');
      }

      return mo;
    },
    {
      maxRetries: 4,
      initialDelay: 750,
      maxDelay: 8000,
      shouldRetry: (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        return msg === 'shipment_not_ready';
      },
    }
  );
}

interface MPMerchantOrder {
  id?: number | string;
  external_reference?: string;
  preference_id?: string;
  order_status?: string;
  status?: string;
  shipments?: MPMerchantOrderShipment[];
  payments?: unknown[];
  [key: string]: unknown;
}

function parseLocalOrderId(externalReference: string | undefined | null): number | null {
  if (!externalReference) return null;

  const trimmed = String(externalReference).trim();
  const direct = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(direct) && String(direct) === trimmed) return direct;

  const match = trimmed.match(/(\d+)/);
  if (!match) return null;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function fetchMerchantOrder(merchantOrderId: string): Promise<MPMerchantOrder> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN no configurado');
  }

  const url = `https://api.mercadopago.com/merchant_orders/${encodeURIComponent(merchantOrderId)}`;

  return retryWithBackoff(
    async () => {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Error consultando merchant_order ${merchantOrderId}: HTTP ${res.status} ${body}`);
      }

      return (await res.json()) as MPMerchantOrder;
    },
    {
      maxRetries: 2,
      initialDelay: 500,
      maxDelay: 2000,
      shouldRetry: (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        return msg.includes('HTTP 429') || msg.includes('HTTP 5');
      },
    }
  );
}

function mapMPShipmentStatusToLocal(status?: string | null): 'pending' | 'processing' | 'shipped' | 'delivered' | 'failed' | 'cancelled' | 'returned' {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'handling':
    case 'ready_to_ship':
      return 'processing';
    case 'shipped':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    case 'returned':
      return 'returned';
    default:
      return 'processing';
  }
}

export async function processMerchantOrderWebhook(
  merchantOrderId: string,
  requestId: string
): Promise<{ success: boolean; orderId?: number; shipmentId?: string; shipmentPending?: boolean; error?: string }> {
  try {
    let mo: MPMerchantOrder;
    try {
      mo = await fetchMerchantOrderUntilHasShipment(merchantOrderId);
    } catch (pollError) {
      const msg = pollError instanceof Error ? pollError.message : String(pollError);
      if (msg !== 'shipment_not_ready') {
        throw pollError;
      }
      mo = await fetchMerchantOrder(merchantOrderId);
    }

    const orderId = parseLocalOrderId(mo.external_reference);
    if (!orderId) {
      logger.warn('[MerchantOrder] No se pudo mapear external_reference a orderId', {
        requestId,
        merchantOrderId,
        externalReference: mo.external_reference,
      });

      return {
        success: false,
        error: 'No se pudo mapear external_reference a una orden local',
      };
    }

    const shipment = (mo.shipments ?? []).find((s) => s?.shipping_mode === 'me2') ?? (mo.shipments ?? [])[0];
    const shipmentId = shipment?.id != null ? String(shipment.id) : null;

    const existingOrder = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: {
        id: true,
        mercadoLibreShipmentId: true,
        metadata: true,
      },
    });

    if (!existingOrder) {
      return { success: false, error: `Orden ${orderId} no encontrada` };
    }

    const currentMetadata = (existingOrder.metadata ?? {}) as Record<string, unknown>;
    const nextMetadata: Record<string, unknown> = {
      ...currentMetadata,
      mp_merchant_order: {
        id: merchantOrderId,
        preference_id: mo.preference_id ?? null,
        status: mo.status ?? null,
        order_status: mo.order_status ?? null,
        updated_at: new Date().toISOString(),
      },
    };

    // Si ya tenemos shipment persistido, sólo actualizamos metadata
    if (existingOrder.mercadoLibreShipmentId) {
      await db
        .update(orders)
        .set({
          metadata: nextMetadata,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      return {
        success: true,
        orderId,
        shipmentId: existingOrder.mercadoLibreShipmentId,
      };
    }

    if (!shipmentId) {
      await db
        .update(orders)
        .set({
          metadata: nextMetadata,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      logger.info('[MerchantOrder] merchant_order sin shipment todavía (eventual consistency)', {
        requestId,
        merchantOrderId,
        orderId,
        shipmentsCount: (mo.shipments ?? []).length,
      });

      return { success: true, orderId, shipmentPending: true };
    }

    await db
      .update(orders)
      .set({
        mercadoLibreShipmentId: shipmentId,
        mercadoLibreShipmentStatus: shipment?.status ?? null,
        shippingStatus: mapMPShipmentStatusToLocal(shipment?.status),
        metadata: {
          ...nextMetadata,
          ml_shipment: {
            id: shipmentId,
            status: shipment?.status ?? null,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    logger.info('[MerchantOrder] Shipment ME2 persistido desde merchant_order', {
      requestId,
      merchantOrderId,
      orderId,
      shipmentId,
      shipmentStatus: shipment?.status,
    });

    return { success: true, orderId, shipmentId };
  } catch (error) {
    logger.error('[MerchantOrder] Error procesando merchant_order', {
      requestId,
      merchantOrderId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
