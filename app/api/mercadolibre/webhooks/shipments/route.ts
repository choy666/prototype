import { NextRequest, NextResponse } from 'next/server';
import { 
  getMLShipmentDetails
} from '@/lib/actions/shipments';
import { db } from '@/lib/db';
import { orders, shipmentHistory } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { 
  MLWebhookShipmentNotification,
  ML_STATUS_TO_LOCAL,
  MLShipment
} from '@/types/mercadolibre';

/**
 * Webhook para recibir notificaciones de envíos de Mercado Libre
 * Mercado Libre envía notificaciones cuando cambian los estados de los shipments
 */
export async function POST(request: NextRequest) {
  try {
    const body: MLWebhookShipmentNotification = await request.json();
    
    logger.info('ML shipment webhook received', {
      applicationId: body.application_id,
      userId: body.user_id,
      topic: body.topic,
      resource: body.resource,
      attempts: body.attempts
    });

    // Validar que sea una notificación de shipments
    if (body.topic !== 'shipments') {
      logger.warn('Invalid webhook topic', { topic: body.topic });
      return NextResponse.json({ error: 'Tópico no válido' }, { status: 400 });
    }

    // Extraer shipment ID del resource
    const shipmentId = body.resource.split('/').pop();
    if (!shipmentId) {
      logger.error('Invalid shipment ID in resource', { resource: body.resource });
      return NextResponse.json({ error: 'ID de shipment inválido' }, { status: 400 });
    }

    // Obtener detalles actualizados del shipment
    const shipment = await getMLShipmentDetails(shipmentId);
    
    // Buscar la orden asociada a este shipment
    const orderData = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        email: orders.email,
        currentStatus: orders.shippingStatus
      })
      .from(orders)
      .where(eq(orders.mercadoLibreShipmentId, shipmentId))
      .limit(1);

    if (!orderData.length) {
      logger.warn('No order found for shipment', { shipmentId });
      return NextResponse.json({ 
        success: true, 
        message: 'Shipment procesado pero sin orden local asociada' 
      });
    }

    const order = orderData[0];
    const newStatus = ML_STATUS_TO_LOCAL[shipment.status as keyof typeof ML_STATUS_TO_LOCAL] || 'pending';
    
    // Actualizar la orden con el nuevo estado y datos de tracking
    await db
      .update(orders)
      .set({
        shippingStatus: newStatus,
        trackingNumber: shipment.tracking_number,
        trackingUrl: shipment.tracking_url,
        mercadoLibreShipmentStatus: shipment.status,
        mercadoLibreShipmentSubstatus: shipment.substatus,
        updatedAt: new Date()
      })
      .where(eq(orders.id, order.id));

    // Insertar registro en historial de envíos
    await db.insert(shipmentHistory).values({
      orderId: order.id,
      shipmentId: shipmentId,
      status: shipment.status,
      substatus: shipment.substatus || null,
      trackingNumber: shipment.tracking_number || null,
      trackingUrl: shipment.tracking_url || null,
      dateCreated: new Date(shipment.date_created),
      source: 'mercadolibre',
      createdAt: new Date()
    });

    logger.info('Order updated with shipment status', {
      orderId: order.id,
      shipmentId,
      oldStatus: order.currentStatus,
      newStatus,
      trackingNumber: shipment.tracking_number,
      historyRecordCreated: true
    });

    // Si el estado cambió, enviar notificación (aquí podrías integrar email, push, etc.)
    if (order.currentStatus !== newStatus) {
      await handleStatusChange(order.id.toString(), newStatus, shipment);
    }

    return NextResponse.json({
      success: true,
      message: 'Shipment status updated successfully',
      orderId: order.id,
      shipmentId,
      newStatus
    });

  } catch (error) {
    logger.error('Error processing ML shipment webhook', error);
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * Maneja los cambios de estado para enviar notificaciones
 */
async function handleStatusChange(
  orderId: string, 
  newStatus: string, 
  shipment: MLShipment
): Promise<void> {
  try {
    logger.info('Handling shipment status change', {
      orderId,
      newStatus,
      shipmentId: shipment.id
    });

    // Aquí podrías implementar:
    // - Envío de emails al cliente
    // - Notificaciones push
    // - Actualización de sistemas externos
    // - Envío de SMS
    // - Integración con WhatsApp Business API

    // Por ahora, solo logueamos el cambio
    const statusMessages = {
      pending: 'Envío pendiente de procesamiento',
      processing: 'Envío en procesamiento',
      shipped: 'Envío en camino',
      delivered: 'Envío entregado exitosamente',
      failed: 'Envío fallido - requiere atención',
      cancelled: 'Envío cancelado',
      returned: 'Envío devuelto'
    };

    const message = statusMessages[newStatus as keyof typeof statusMessages] || 
                   `Estado de envío actualizado a: ${newStatus}`;

    logger.info('Status change notification', {
      orderId,
      message,
      trackingNumber: shipment.tracking_number,
      trackingUrl: shipment.tracking_url
    });

    // TODO: Implementar notificaciones reales
    // await sendEmailNotification(order.email, message);
    // await sendPushNotification(order.userId, message);

  } catch (error) {
    logger.error('Error handling status change', error);
    // No lanzamos el error para no interrumpir el webhook
  }
}

/**
 * GET endpoint para verificar que el webhook está activo
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'mercadolibre-webhook',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}
