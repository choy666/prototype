// app/api/webhooks/mercado-pago/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, products, users, shippingMethods } from '@/lib/schema';
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
    logger.info('Webhook MercadoPago: Inicio de procesamiento', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    });

    const body = await req.json();

    // Validación básica de headers
    const requestId = req.headers.get('x-request-id');
    if (!requestId) {
      logger.warn('Webhook MercadoPago: Falta header x-request-id');
      return NextResponse.json({ error: 'Faltan headers requeridos' }, { status: 400 });
    }

    // Procesar el evento recibido
    const { action, data } = body;

    logger.info('Webhook MercadoPago recibido', {
      action,
      dataId: data?.id,
      status: data?.status,
      hasMetadata: !!data?.metadata,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    });

    if (action === 'payment.updated' && data?.status === 'approved') {
      logger.info('Procesando pago aprobado - llamando a handlePaymentApproved');
      await handlePaymentApproved(data as { id: string; metadata?: MercadoPagoMetadata });
    } else if (action === 'payment.created' || action === 'payment.updated') {
      // Otros eventos de pago - solo logging por ahora
      logger.info('Evento de pago procesado (no aprobado)', { action, status: data?.status });
    } else {
      logger.warn('Evento de webhook no reconocido', { action, status: data?.status });
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

async function handlePaymentApproved(data: { id: string; metadata?: MercadoPagoMetadata }) {
  const paymentId = data.id.toString();

  try {
    logger.info('handlePaymentApproved: Iniciando procesamiento', {
      paymentId,
      hasMetadata: !!data.metadata,
      metadataKeys: data.metadata ? Object.keys(data.metadata) : []
    });

    // Verificar que no hayamos procesado este pago antes
    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.mercadoPagoId, paymentId))
      .limit(1);

    if (existingOrder.length > 0) {
      logger.warn('Pago ya procesado anteriormente', { paymentId, orderId: existingOrder[0].id });
      return;
    }

    // Validar metadata del pago
    const metadata = data.metadata;
    if (!metadata) {
      logger.error('handlePaymentApproved: Metadata faltante en pago aprobado', {
        paymentId,
        availableData: Object.keys(data)
      });
      throw new Error('Metadata faltante en pago aprobado');
    }

    logger.info('handlePaymentApproved: Metadata encontrada', {
      paymentId,
      metadataKeys: Object.keys(metadata),
      userId: metadata.userId,
      hasItems: !!metadata.items,
      hasShippingAddress: !!metadata.shippingAddress
    });

    const {
      userId: userIdStr,
      shippingAddress: shippingAddressJson,
      shippingMethodId: shippingMethodIdStr,
      items: itemsJson,
      shippingCost: shippingCostStr
    } = metadata;

    // Validaciones de campos requeridos
    if (!userIdStr || !itemsJson) {
      logger.error('Metadata incompleta en pago aprobado', {
        paymentId,
        hasUserId: !!userIdStr,
        hasItems: !!itemsJson,
        metadataKeys: Object.keys(metadata)
      });
      throw new Error('Metadata incompleta: faltan userId o items');
    }

    // Convertir y validar userId
    const userId = parseInt(userIdStr);
    if (isNaN(userId) || userId <= 0) {
      logger.error('userId inválido en metadata', { paymentId, userIdStr });
      throw new Error('userId inválido');
    }

    // Verificar que el usuario existe
    const userExists = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userExists.length === 0) {
      logger.error('Usuario no encontrado', { paymentId, userId });
      throw new Error('Usuario no encontrado');
    }

    // Parsear y validar items
    let items;
    try {
      items = JSON.parse(itemsJson);
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Items debe ser un array no vacío');
      }
    } catch (error) {
      logger.error('Error parseando items del metadata', { paymentId, itemsJson, error });
      throw new Error('Error parseando items del metadata');
    }

    // Validar estructura de items
    for (const item of items) {
      if (!item.id || !item.price || !item.quantity) {
        logger.error('Item inválido en metadata', { paymentId, item });
        throw new Error('Item inválido: faltan campos requeridos');
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new Error('Cantidad inválida en item');
      }
    }

    // Parsear shippingAddress si existe
    let shippingAddress = null;
    if (shippingAddressJson) {
      try {
        shippingAddress = JSON.parse(shippingAddressJson);
      } catch (error) {
        logger.error('Error parseando shippingAddress', { paymentId, shippingAddressJson, error });
        throw new Error('Error parseando shippingAddress');
      }
    }

    // Convertir shippingMethodId si existe
    let shippingMethodId = null;
    if (shippingMethodIdStr) {
      shippingMethodId = parseInt(shippingMethodIdStr);
      if (isNaN(shippingMethodId) || shippingMethodId <= 0) {
        logger.error('shippingMethodId inválido', { paymentId, shippingMethodIdStr });
        throw new Error('shippingMethodId inválido');
      }
      // Verificar que el método de envío existe
      const methodExists = await db.select().from(shippingMethods).where(eq(shippingMethods.id, shippingMethodId)).limit(1);
      if (methodExists.length === 0) {
        logger.error('Método de envío no encontrado', { paymentId, shippingMethodId });
        throw new Error('Método de envío no encontrado');
      }
    }

    logger.info('Validaciones de metadata completadas', {
      paymentId,
      userId,
      itemCount: items.length,
      hasShippingAddress: !!shippingAddress,
      hasShippingMethod: !!shippingMethodId
    });

    // Calcular total de items con validación
    const calculatedTotal = items.reduce((sum: number, item: { id: number; price: string; quantity: number }) => {
      const price = parseFloat(item.price);
      if (isNaN(price) || price < 0) {
        throw new Error(`Precio inválido en item ${item.id}`);
      }
      return sum + (price * item.quantity);
    }, 0);

    const shippingCost = shippingCostStr ? parseFloat(shippingCostStr) : 0;
    if (isNaN(shippingCost) || shippingCost < 0) {
      logger.error('Costo de envío inválido', { paymentId, shippingCostStr });
      throw new Error('Costo de envío inválido');
    }

    const finalTotal = calculatedTotal + shippingCost;

    // Usar transacción para asegurar atomicidad
    await db.transaction(async (tx) => {
      // Crear la orden
      const orderData = {
        userId,
        total: finalTotal.toString(),
        status: 'paid' as const,
        paymentId,
        mercadoPagoId: paymentId,
        shippingAddress,
        shippingMethodId,
        shippingCost: shippingCost.toString(),
      };

      logger.info('Creando orden', { orderData });

      const newOrder = await tx.insert(orders).values(orderData).returning();

      if (newOrder.length === 0) {
        throw new Error('No se pudo crear la orden');
      }

      const orderId = newOrder[0].id;
      logger.info('Orden creada exitosamente', { orderId, paymentId });

      // Crear los items de la orden y actualizar stock
      logger.info('Creando items de orden', { orderId, itemCount: items.length });
      for (const item of items) {
        // Verificar que el producto existe y tiene stock suficiente
        const product = await tx.select().from(products).where(eq(products.id, item.id)).limit(1);
        if (product.length === 0) {
          throw new Error(`Producto ${item.id} no encontrado`);
        }
        if (product[0].stock < item.quantity) {
          throw new Error(`Stock insuficiente para producto ${item.id}`);
        }

        // Crear item de orden
        await tx.insert(orderItems).values({
          orderId,
          productId: item.id,
          quantity: item.quantity,
          price: parseFloat(item.price).toString(),
        });

        // Actualizar stock del producto
        await tx.update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}` })
          .where(eq(products.id, item.id));

        logger.info('Item de orden creado y stock actualizado', {
          orderId,
          productId: item.id,
          quantity: item.quantity
        });
      }
    });

    logger.info('Pago aprobado procesado completamente', {
      paymentId,
      itemCount: items.length,
      total: finalTotal,
      userId
    });

  } catch (error) {
    logger.error('Error procesando pago aprobado', {
      paymentId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
