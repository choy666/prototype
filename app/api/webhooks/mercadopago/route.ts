// app/api/webhooks/mercadopago/route.ts
import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { logger } from '@/lib/utils/logger';
import { db } from '@/lib/db';
import { orders, orderItems } from '@/lib/schema';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

export async function POST(req: Request) {
  try {
    logger.info('Webhook MercadoPago: Inicio de procesamiento', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    });

    const body = await req.text();
    const payload = JSON.parse(body);
    const { action, data } = payload;

    // Extraer id y type del evento
    const eventId = data?.id;
    const eventType = action;

    logger.info('Webhook MercadoPago recibido', {
      eventType,
      eventId,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    });

    if ((eventType === 'payment.updated' || eventType === 'payment.created') && eventId) {
      logger.info(`Procesando evento ${eventType} - consultando API de MercadoPago`);
      await handlePaymentEvent(eventId.toString());
    } else {
      logger.info('Evento de webhook no procesado', { eventType });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error procesando webhook MercadoPago', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

async function handlePaymentEvent(paymentId: string) {
  try {
    logger.info('handlePaymentEvent: Consultando pago en MercadoPago API', { paymentId });

    // Hacer consulta directa a la API de Mercado Pago con ACCESS_TOKEN
    const payment = await new Payment(client).get({ id: paymentId });

    if (!payment) {
      logger.error('Pago no encontrado en MercadoPago API', { paymentId });
      return;
    }

    // Confirmar que el pago es válido, pertenece a tu cuenta y tiene el estado correcto
    const validStatuses = ['approved', 'pending'];
    if (!payment.status || !validStatuses.includes(payment.status)) {
      logger.info('Pago con estado no válido', { paymentId, status: payment.status });
      return;
    }

    logger.info('Pago confirmado: válido, pertenece a la cuenta y estado correcto', {
      paymentId,
      status: payment.status,
      belongsToAccount: true // Confirmado por el access token usado en la consulta
    });

    // Si el pago está aprobado, crear la orden
    if (payment.status === 'approved') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createOrderFromPayment(payment as any);
    }

  } catch (error) {
    logger.error('Error procesando evento de pago', {
      paymentId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function createOrderFromPayment(payment: any) {
  try {
    logger.info('Creando orden desde pago aprobado', { paymentId: payment.id });

    // Extraer metadata del pago
    const metadata = payment.metadata || {};
    const userId = parseInt(metadata.userId);
    const shippingAddress = metadata.shippingAddress ? JSON.parse(metadata.shippingAddress) : null;
    const shippingMethodId = parseInt(metadata.shippingMethodId);
    const items = metadata.items ? JSON.parse(metadata.items) : [];
    const shippingCost = parseFloat(metadata.shippingCost || '0');
    const total = parseFloat(metadata.total || '0');

    if (!userId || !items.length) {
      logger.error('Metadata incompleta para crear orden', { userId, itemsCount: items.length });
      return;
    }

    // Crear la orden
    const newOrder = await db.insert(orders).values({
      userId,
      total: total.toString(),
      status: 'paid',
      paymentId: payment.id.toString(),
      mercadoPagoId: payment.id.toString(),
      shippingAddress,
      shippingMethodId,
      shippingCost: shippingCost.toString(),
    }).returning({ id: orders.id });

    const orderId = newOrder[0].id;
    logger.info('Orden creada exitosamente', { orderId, userId });

    // Crear los items de la orden
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderItemsData = items.map((item: any) => ({
      orderId,
      productId: parseInt(item.id),
      quantity: item.quantity,
      price: (item.discount && item.discount > 0
        ? parseFloat(item.price) * (1 - item.discount / 100)
        : parseFloat(item.price)).toString(),
    }));

    await db.insert(orderItems).values(orderItemsData);
    logger.info('Items de orden creados', { orderId, itemsCount: orderItemsData.length });

  } catch (error) {
    logger.error('Error creando orden desde pago', {
      paymentId: payment.id,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
