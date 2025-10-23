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
    if (metadata.userId === undefined || metadata.userId === null) {
      logger.error('Metadata incompleta: userId es undefined o null', {
        userId: metadata.userId,
        userIdType: typeof metadata.userId,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    if (typeof metadata.userId !== 'string') {
      logger.error('Metadata incompleta: userId no es string', {
        userId: metadata.userId,
        userIdType: typeof metadata.userId,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    const trimmedUserId = metadata.userId.trim();
    if (trimmedUserId === '') {
      logger.error('Metadata incompleta: userId es string vacío', {
        userId: metadata.userId,
        trimmedUserId,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    const userId = parseInt(trimmedUserId, 10);
    if (isNaN(userId) || userId <= 0) {
      logger.error('Metadata incompleta: userId no es un número válido positivo', {
        userId: metadata.userId,
        trimmedUserId,
        userIdParsed: userId,
        isNaN: isNaN(userId),
        isPositive: userId > 0,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    // Validación de items
    if (metadata.items === undefined || metadata.items === null) {
      logger.error('Metadata incompleta: items es undefined o null', {
        items: metadata.items,
        itemsType: typeof metadata.items,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    if (typeof metadata.items !== 'string') {
      logger.error('Metadata incompleta: items no es string', {
        items: metadata.items,
        itemsType: typeof metadata.items,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    const trimmedItems = metadata.items.trim();
    if (trimmedItems === '') {
      logger.error('Metadata incompleta: items es string vacío', {
        items: metadata.items,
        trimmedItems,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    let parsedItems: any[];
    try {
      parsedItems = JSON.parse(trimmedItems);
    } catch (error) {
      logger.error('Metadata incompleta: items no es JSON válido', {
        items: metadata.items,
        trimmedItems,
        parseError: error instanceof Error ? error.message : String(error),
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    if (!Array.isArray(parsedItems)) {
      logger.error('Metadata incompleta: items parseado no es array', {
        itemsParsed: parsedItems,
        itemsType: typeof parsedItems,
        isArray: Array.isArray(parsedItems),
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    if (parsedItems.length === 0) {
      logger.error('Metadata incompleta: items array está vacío', {
        itemsParsed: parsedItems,
        itemsCount: parsedItems.length,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    // Validación de shippingAddress
    let shippingAddress = null;
    if (metadata.shippingAddress) {
      if (typeof metadata.shippingAddress !== 'string') {
        logger.error('Metadata incompleta: shippingAddress no es string', {
          shippingAddress: metadata.shippingAddress,
          shippingAddressType: typeof metadata.shippingAddress,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
      const trimmedShippingAddress = metadata.shippingAddress.trim();
      if (trimmedShippingAddress !== '') {
        try {
          shippingAddress = JSON.parse(trimmedShippingAddress);
        } catch (error) {
          logger.error('Metadata incompleta: shippingAddress no es JSON válido', {
            shippingAddress: metadata.shippingAddress,
            trimmedShippingAddress,
            parseError: error instanceof Error ? error.message : String(error),
            metadataKeys: Object.keys(metadata)
          });
          return;
        }
      }
    }

    // Validación de shippingMethodId
    if (metadata.shippingMethodId === undefined || metadata.shippingMethodId === null) {
      logger.error('Metadata incompleta: shippingMethodId es undefined o null', {
        shippingMethodId: metadata.shippingMethodId,
        shippingMethodIdType: typeof metadata.shippingMethodId,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    let shippingMethodId: number;
    if (typeof metadata.shippingMethodId === 'string') {
      const trimmedShippingMethodId = metadata.shippingMethodId.trim();
      shippingMethodId = parseInt(trimmedShippingMethodId, 10);
      if (isNaN(shippingMethodId) || shippingMethodId <= 0) {
        logger.error('Metadata incompleta: shippingMethodId no es número válido', {
          shippingMethodId: metadata.shippingMethodId,
          trimmedShippingMethodId,
          shippingMethodIdParsed: shippingMethodId,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
    } else if (typeof metadata.shippingMethodId === 'number') {
      shippingMethodId = metadata.shippingMethodId;
      if (shippingMethodId <= 0) {
        logger.error('Metadata incompleta: shippingMethodId no es positivo', {
          shippingMethodId,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
    } else {
      logger.error('Metadata incompleta: shippingMethodId no es string ni number', {
        shippingMethodId: metadata.shippingMethodId,
        shippingMethodIdType: typeof metadata.shippingMethodId,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    const items = parsedItems;

    // Validación de shippingCost
    let shippingCost = 0;
    if (metadata.shippingCost !== undefined && metadata.shippingCost !== null) {
      if (typeof metadata.shippingCost === 'string') {
        shippingCost = parseFloat(metadata.shippingCost.trim());
      } else if (typeof metadata.shippingCost === 'number') {
        shippingCost = metadata.shippingCost;
      } else {
        logger.error('Metadata incompleta: shippingCost no es string ni number', {
          shippingCost: metadata.shippingCost,
          shippingCostType: typeof metadata.shippingCost,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
      if (isNaN(shippingCost)) {
        logger.error('Metadata incompleta: shippingCost no es número válido', {
          shippingCost: metadata.shippingCost,
          shippingCostParsed: shippingCost,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
    }

    // Validación de total
    let total = 0;
    if (metadata.total !== undefined && metadata.total !== null) {
      if (typeof metadata.total === 'string') {
        total = parseFloat(metadata.total.trim());
      } else if (typeof metadata.total === 'number') {
        total = metadata.total;
      } else {
        logger.error('Metadata incompleta: total no es string ni number', {
          total: metadata.total,
          totalType: typeof metadata.total,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
      if (isNaN(total) || total < 0) {
        logger.error('Metadata incompleta: total no es número válido positivo', {
          total: metadata.total,
          totalParsed: total,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
    }

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
