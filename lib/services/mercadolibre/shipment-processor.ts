import { db } from '@/lib/db';
import { orders, shipmentHistory } from '@/lib/schema';
import { getMLShipmentDetails } from '@/lib/actions/shipments';
import { logger } from '@/lib/utils/logger';
import { eq } from 'drizzle-orm';
import { ML_STATUS_TO_LOCAL, MLShipment } from '@/types/mercadolibre';

function mapShipmentStatus(status?: string) {
  if (!status) return 'pending';
  return ML_STATUS_TO_LOCAL[status as keyof typeof ML_STATUS_TO_LOCAL] || 'pending';
}

async function persistShipmentHistory(orderId: number, shipment: MLShipment) {
  await db.insert(shipmentHistory).values({
    orderId,
    shipmentId: shipment.id?.toString() ?? null,
    status: shipment.status,
    substatus: shipment.substatus || null,
    trackingNumber: shipment.tracking_number || null,
    trackingUrl: shipment.tracking_url || null,
    dateCreated: shipment.date_created ? new Date(shipment.date_created) : new Date(),
    source: 'mercadolibre',
    createdAt: new Date(),
  });
}

async function handleStatusChangeLogging(orderId: number, newStatus: string, shipment: MLShipment) {
  const statusMessages: Record<string, string> = {
    pending: 'Envío pendiente de procesamiento',
    processing: 'Envío en procesamiento',
    shipped: 'Envío en camino',
    delivered: 'Envío entregado exitosamente',
    failed: 'Envío fallido - requiere atención',
    cancelled: 'Envío cancelado',
    returned: 'Envío devuelto',
  };

  const message = statusMessages[newStatus] || `Estado de envío actualizado a: ${newStatus}`;

  logger.info('[ML Webhook][Shipments] Cambio de estado registrado', {
    orderId,
    newStatus,
    message,
    trackingNumber: shipment.tracking_number,
    trackingUrl: shipment.tracking_url,
  });
}

export async function processShipmentWebhook(resource: string) {
  const shipmentId = resource.split('/').pop();

  if (!shipmentId) {
    return { success: false, error: 'ID de shipment no válido' };
  }

  try {
    const shipment = await getMLShipmentDetails(shipmentId);

    const [order] = await db
      .select({
        id: orders.id,
        shippingStatus: orders.shippingStatus,
        shippingAgency: orders.shippingAgency,
      })
      .from(orders)
      .where(eq(orders.mercadoLibreShipmentId, shipmentId))
      .limit(1);

    if (!order) {
      logger.warn('[ML Webhook][Shipments] Orden no encontrada para shipment', {
        shipmentId,
      });

      return {
        success: true,
        message: 'Shipment procesado sin orden local asociada',
      };
    }

    const newStatus = mapShipmentStatus(shipment.status);
    const updateData: Record<string, unknown> = {
      shippingStatus: newStatus,
      trackingNumber: shipment.tracking_number,
      trackingUrl: shipment.tracking_url,
      mercadoLibreShipmentStatus: shipment.status,
      mercadoLibreShipmentSubstatus: shipment.substatus,
      updatedAt: new Date(),
    };

    const addressLine = shipment.receiver_address?.address_line || '';
    const isAgencyAddress =
      addressLine.toLowerCase().includes('agencia') ||
      addressLine.toLowerCase().includes('sucursal') ||
      addressLine.toLowerCase().includes('correo argentino');

    if (
      shipment.receiver_address &&
      shipment.logistic_type === 'drop_off' &&
      isAgencyAddress &&
      !order.shippingAgency
    ) {
      updateData.shippingAgency = {
        id: shipment.receiver_address.id,
        name: addressLine.split(',')[0]?.trim() || 'Agencia Mercado Libre',
        address: {
          street_name: shipment.receiver_address.street_name,
          street_number: shipment.receiver_address.street_number,
          address_line: shipment.receiver_address.address_line,
          comment: shipment.receiver_address.comment,
        },
        phone: shipment.carrier_info?.phone || null,
        hours: null,
      };
    }

    await db.update(orders).set(updateData).where(eq(orders.id, order.id));
    await persistShipmentHistory(order.id, shipment);

    if (order.shippingStatus !== newStatus) {
      await handleStatusChangeLogging(order.id, newStatus, shipment);
    }

    logger.info('[ML Webhook][Shipments] Orden actualizada', {
      orderId: order.id,
      shipmentId,
      oldStatus: order.shippingStatus,
      newStatus,
    });

    return {
      success: true,
      orderId: order.id,
      shipmentId,
      newStatus,
    };
  } catch (error) {
    logger.error('[ML Webhook][Shipments] Error procesando shipment', {
      shipmentId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
