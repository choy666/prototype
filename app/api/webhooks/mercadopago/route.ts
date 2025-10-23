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

    // Para testing local, simular respuesta de MercadoPago
    if (process.env.NODE_ENV === 'development' && paymentId === '123456789') {
      logger.info('Modo desarrollo: simulando respuesta de MercadoPago API');

      // Simular respuesta de MercadoPago con metadata
      const mockPayment = {
        id: paymentId,
        status: 'approved',
        metadata: {
          userId: '4', // Usar ID de usuario existente
          shippingAddress: JSON.stringify({
            nombre: 'Test User',
            direccion: 'Calle Falsa 123',
            ciudad: 'Buenos Aires',
            provincia: 'Buenos Aires',
            codigoPostal: '1000',
            telefono: '1123456789'
          }),
          shippingMethodId: '1',
          items: JSON.stringify([{
            id: '1', // Usar ID de producto existente
            name: 'Producto de Prueba',
            price: '1000.00',
            quantity: 2
          }]),
          shippingCost: '500.00',
          subtotal: '2000.00',
          total: '2500.00'
        }
      };

      logger.info('Pago simulado confirmado: válido, pertenece a la cuenta y estado correcto', {
        paymentId,
        status: mockPayment.status,
        belongsToAccount: true,
        metadata: mockPayment.metadata || {}
      });

      // Si el pago está aprobado, crear la orden
      if (mockPayment.status === 'approved') {
        await createOrderFromPayment(mockPayment);
      }

      return;
    }

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
      belongsToAccount: true, // Confirmado por el access token usado en la consulta
      metadata: payment.metadata || {}
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
    logger.info('Metadata recibida del pago', {
      paymentId: payment.id,
      metadataKeys: Object.keys(metadata),
      metadata: metadata
    });

    // Validación robusta de userId
    if (!metadata.userId || typeof metadata.userId !== 'string' || metadata.userId.trim() === '') {
      logger.error('Metadata incompleta: userId faltante, vacío o no es string válido', {
        userId: metadata.userId,
        userIdType: typeof metadata.userId,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    const userId = parseInt(metadata.userId.trim());
    if (isNaN(userId) || userId <= 0) {
      logger.error('Metadata incompleta: userId no es un número válido positivo', {
        userId: metadata.userId,
        userIdParsed: userId,
        isNaN: isNaN(userId),
        isPositive: userId > 0
      });
      return;
    }

    // Validación de items
    if (!metadata.items || typeof metadata.items !== 'string' || metadata.items.trim() === '') {
      logger.error('Metadata incompleta: items faltante o no es string válido', {
        items: metadata.items,
        itemsType: typeof metadata.items,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    let parsedItems: any[];
    try {
      parsedItems = JSON.parse(metadata.items);
    } catch (error) {
      logger.error('Metadata incompleta: items no es JSON válido', {
        items: metadata.items,
        parseError: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      logger.error('Metadata incompleta: items no es array válido o está vacío', {
        itemsParsed: parsedItems,
        itemsCount: parsedItems.length,
        isArray: Array.isArray(parsedItems)
      });
      return;
    }

    const shippingAddress = metadata.shippingAddress ? JSON.parse(metadata.shippingAddress) : null;
    const shippingMethodId = parseInt(metadata.shippingMethodId);
    const items = parsedItems;
    const shippingCost = parseFloat(metadata.shippingCost || '0');
    const total = parseFloat(metadata.total || '0');

    logger.info('Metadata validada correctamente', {
      userId,
      shippingMethodId,
      itemsCount: items.length,
      hasShippingAddress: !!shippingAddress
    });

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
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      metadata: payment.metadata || {}
    });
    throw error;
  }
}
