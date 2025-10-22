// app/api/webhooks/mercado-pago/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, products } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

interface MercadoPagoMetadata {
  userId: string;
  shippingAddress?: string;
  shippingMethodId?: string;
  items: string;
  shippingCost?: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validación básica de headers
    const requestId = req.headers.get('x-request-id');
    if (!requestId) {
      logger.warn('Webhook MercadoPago: Falta header x-request-id');
      return NextResponse.json({ error: 'Faltan headers requeridos' }, { status: 400 });
    }

    // Procesar el evento recibido
    const { action, data } = body;

    logger.info('Webhook MercadoPago recibido', { action, dataId: data?.id });

    if (action === 'payment.updated' && data?.status === 'approved') {
      await handlePaymentApproved(data as { id: string; metadata?: MercadoPagoMetadata });
    } else if (action === 'payment.created' || action === 'payment.updated') {
      // Otros eventos de pago - solo logging por ahora
      logger.info('Evento de pago procesado (no aprobado)', { action, status: data?.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error procesando webhook MercadoPago', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

async function handlePaymentApproved(data: { id: string; metadata?: MercadoPagoMetadata }) {
  try {
    logger.info('Procesando pago aprobado', { paymentId: data.id });

    // Verificar que no hayamos procesado este pago antes
    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.mercadoPagoId, data.id.toString()))
      .limit(1);

    if (existingOrder.length > 0) {
      logger.warn('Pago ya procesado anteriormente', { paymentId: data.id, orderId: existingOrder[0].id });
      return;
    }

    // Extraer metadata del pago
    const metadata = data.metadata;
    if (!metadata) {
      logger.error('Metadata faltante en pago aprobado', { paymentId: data.id });
      return;
    }
    const {
      userId,
      shippingAddress,
      shippingMethodId,
      items: itemsJson,
      shippingCost
    } = metadata;

    if (!userId || !itemsJson) {
      logger.error('Metadata incompleta en pago aprobado', { paymentId: data.id, metadata });
      return;
    }

    // Parsear items
    let items;
    try {
      items = JSON.parse(itemsJson);
    } catch (error) {
      logger.error('Error parseando items del metadata', { paymentId: data.id, itemsJson, error });
      return;
    }

    // Calcular total de items
    const calculatedTotal = items.reduce((sum: number, item: unknown) => {
      const itemData = item as { price: string; quantity: number };
      return sum + (parseFloat(itemData.price) * itemData.quantity);
    }, 0) + parseFloat((shippingCost as string) || '0');

    // Crear la orden
    const orderData = {
      userId: parseInt(userId),
      total: calculatedTotal.toString(),
      status: 'paid' as const,
      paymentId: data.id.toString(),
      mercadoPagoId: data.id.toString(),
      shippingAddress: shippingAddress ? JSON.parse(shippingAddress) : null,
      shippingMethodId: shippingMethodId ? parseInt(shippingMethodId) : null,
      shippingCost: (parseFloat(shippingCost || '0')).toString(),
    };

    logger.info('Creando orden', { orderData });

    const newOrder = await db.insert(orders).values(orderData).returning();

    if (newOrder.length === 0) {
      throw new Error('No se pudo crear la orden');
    }

    const orderId = newOrder[0].id;
    logger.info('Orden creada exitosamente', { orderId, paymentId: data.id });

    // Crear los items de la orden
    for (const item of items) {
      await db.insert(orderItems).values({
        orderId: orderId,
        productId: item.id,
        quantity: item.quantity,
        price: parseFloat(item.price).toString(),
      });

      // Actualizar stock del producto
      await db.update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}` })
        .where(eq(products.id, item.id));

      logger.info('Item de orden creado y stock actualizado', {
        orderId,
        productId: item.id,
        quantity: item.quantity
      });
    }

    logger.info('Pago aprobado procesado completamente', {
      paymentId: data.id,
      orderId,
      itemCount: items.length,
      total: calculatedTotal
    });

  } catch (error) {
    logger.error('Error procesando pago aprobado', {
      paymentId: data.id,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
