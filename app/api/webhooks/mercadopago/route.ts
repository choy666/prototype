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
    if (process.env.NODE_ENV === 'development' && (paymentId === '123456789' || paymentId === '987654321')) {
      logger.info('Modo desarrollo: simulando respuesta de MercadoPago API');

      // Simular respuesta de MercadoPago con metadata
      const mockPayment = {
        id: paymentId,
        status: paymentId === '123456789' ? 'approved' : 'rejected',
        metadata: paymentId === '123456789' ? {
          user_id: '4', // Usar ID de usuario existente (snake_case)
          shipping_address: JSON.stringify({
            nombre: 'Test User',
            direccion: 'Calle Falsa 123',
            ciudad: 'Buenos Aires',
            provincia: 'Buenos Aires',
            codigoPostal: '1000',
            telefono: '1123456789'
          }),
          shipping_method_id: '1',
          items: JSON.stringify([{
            id: '1', // Usar ID de producto existente
            name: 'Producto de Prueba',
            price: '1000.00',
            quantity: 2
          }]),
          shipping_cost: '500.00',
          subtotal: '2000.00',
          total: '2500.00'
        } : {
          user_id: '4', // Usar ID de usuario existente (snake_case)
          total: '2500.00'
        }
      };

      logger.info('Pago simulado confirmado: válido, pertenece a la cuenta y estado correcto', {
        paymentId,
        status: mockPayment.status,
        belongsToAccount: true,
        metadata: mockPayment.metadata || {}
      });

      // Manejar según el status del pago
      if (mockPayment.status === 'approved') {
        await createOrderFromPayment(mockPayment);
      } else if (mockPayment.status === 'rejected') {
        await createRejectedOrderFromPayment(mockPayment);
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
    const validStatuses = ['approved', 'pending', 'rejected'];
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

    // Manejar según el status del pago
    if (payment.status === 'approved') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createOrderFromPayment(payment as any);
    } else if (payment.status === 'rejected') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createRejectedOrderFromPayment(payment as any);
    }
    // Para 'pending', no hacer nada adicional por ahora

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

    // Validación robusta de userId (usando snake_case como MercadoPago)
    if (metadata.user_id === undefined || metadata.user_id === null) {
      logger.error('Metadata incompleta: user_id es undefined o null', {
        user_id: metadata.user_id,
        userIdType: typeof metadata.user_id,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    if (typeof metadata.user_id !== 'string') {
      logger.error('Metadata incompleta: user_id no es string - loggeando valor crudo y abortando creación de orden', {
        user_id: metadata.user_id,
        userIdType: typeof metadata.user_id,
        metadataKeys: Object.keys(metadata),
        rawMetadata: metadata
      });
      return;
    }

    const trimmedUserId = metadata.user_id.trim();
    if (trimmedUserId === '') {
      logger.error('Metadata incompleta: user_id es string vacío', {
        user_id: metadata.user_id,
        trimmedUserId,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    const userId = parseInt(trimmedUserId, 10);
    if (isNaN(userId) || userId <= 0) {
      logger.error('Metadata incompleta: user_id no es un número válido positivo', {
        user_id: metadata.user_id,
        trimmedUserId,
        userIdParsed: userId,
        isNaN: isNaN(userId),
        isPositive: userId > 0,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    // Validación de items (usando snake_case)
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

    // Validación de shippingAddress (usando snake_case)
    let shippingAddress = null;
    if (metadata.shipping_address) {
      if (typeof metadata.shipping_address !== 'string') {
        logger.error('Metadata incompleta: shipping_address no es string', {
          shipping_address: metadata.shipping_address,
          shippingAddressType: typeof metadata.shipping_address,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
      const trimmedShippingAddress = metadata.shipping_address.trim();
      if (trimmedShippingAddress !== '') {
        try {
          shippingAddress = JSON.parse(trimmedShippingAddress);
        } catch (error) {
          logger.error('Metadata incompleta: shipping_address no es JSON válido', {
            shipping_address: metadata.shipping_address,
            trimmedShippingAddress,
            parseError: error instanceof Error ? error.message : String(error),
            metadataKeys: Object.keys(metadata)
          });
          return;
        }
      }
    }

    // Validación de shippingMethodId (usando snake_case)
    if (metadata.shipping_method_id === undefined || metadata.shipping_method_id === null) {
      logger.error('Metadata incompleta: shipping_method_id es undefined o null', {
        shipping_method_id: metadata.shipping_method_id,
        shippingMethodIdType: typeof metadata.shipping_method_id,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    let shippingMethodId: number;
    if (typeof metadata.shipping_method_id === 'string') {
      const trimmedShippingMethodId = metadata.shipping_method_id.trim();
      shippingMethodId = parseInt(trimmedShippingMethodId, 10);
      if (isNaN(shippingMethodId) || shippingMethodId <= 0) {
        logger.error('Metadata incompleta: shipping_method_id no es número válido', {
          shipping_method_id: metadata.shipping_method_id,
          trimmedShippingMethodId,
          shippingMethodIdParsed: shippingMethodId,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
    } else if (typeof metadata.shipping_method_id === 'number') {
      shippingMethodId = metadata.shipping_method_id;
      if (shippingMethodId <= 0) {
        logger.error('Metadata incompleta: shipping_method_id no es positivo', {
          shippingMethodId,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
    } else {
      logger.error('Metadata incompleta: shipping_method_id no es string ni number', {
        shipping_method_id: metadata.shipping_method_id,
        shippingMethodIdType: typeof metadata.shipping_method_id,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    const items = parsedItems;

    // Validación de shippingCost (usando snake_case)
    let shippingCost = 0;
    if (metadata.shipping_cost !== undefined && metadata.shipping_cost !== null) {
      if (typeof metadata.shipping_cost === 'string') {
        shippingCost = parseFloat(metadata.shipping_cost.trim());
      } else if (typeof metadata.shipping_cost === 'number') {
        shippingCost = metadata.shipping_cost;
      } else {
        logger.error('Metadata incompleta: shipping_cost no es string ni number', {
          shipping_cost: metadata.shipping_cost,
          shippingCostType: typeof metadata.shipping_cost,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
      if (isNaN(shippingCost)) {
        logger.error('Metadata incompleta: shipping_cost no es número válido', {
          shipping_cost: metadata.shipping_cost,
          shippingCostParsed: shippingCost,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
    }

    // Validación de total (usando snake_case)
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
      hasShippingAddress: !!shippingAddress,
      metadataKeys: Object.keys(metadata)
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

/* eslint-disable @typescript-eslint/no-explicit-any */
async function createRejectedOrderFromPayment(payment: any) {
  try {
    logger.info('Procesando pago rechazado', { paymentId: payment.id });

    // Extraer metadata del pago
    const metadata = payment.metadata || {};
    logger.info('Metadata recibida del pago rechazado', {
      paymentId: payment.id,
      metadataKeys: Object.keys(metadata),
      metadata: metadata
    });

    // Validación básica de userId (usando snake_case como MercadoPago)
    if (metadata.user_id === undefined || metadata.user_id === null) {
      logger.error('Metadata incompleta para pago rechazado: user_id es undefined o null', {
        user_id: metadata.user_id,
        userIdType: typeof metadata.user_id,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    if (typeof metadata.user_id !== 'string') {
      logger.error('Metadata incompleta para pago rechazado: user_id no es string', {
        user_id: metadata.user_id,
        userIdType: typeof metadata.user_id,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    const trimmedUserId = metadata.user_id.trim();
    if (trimmedUserId === '') {
      logger.error('Metadata incompleta para pago rechazado: user_id es string vacío', {
        user_id: metadata.user_id,
        trimmedUserId,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    const userId = parseInt(trimmedUserId, 10);
    if (isNaN(userId) || userId <= 0) {
      logger.error('Metadata incompleta para pago rechazado: user_id no es un número válido positivo', {
        user_id: metadata.user_id,
        trimmedUserId,
        userIdParsed: userId,
        isNaN: isNaN(userId),
        isPositive: userId > 0,
        metadataKeys: Object.keys(metadata)
      });
      return;
    }

    // Validación de total (usando snake_case)
    let total = 0;
    if (metadata.total !== undefined && metadata.total !== null) {
      if (typeof metadata.total === 'string') {
        total = parseFloat(metadata.total.trim());
      } else if (typeof metadata.total === 'number') {
        total = metadata.total;
      } else {
        logger.error('Metadata incompleta para pago rechazado: total no es string ni number', {
          total: metadata.total,
          totalType: typeof metadata.total,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
      if (isNaN(total) || total < 0) {
        logger.error('Metadata incompleta para pago rechazado: total no es número válido positivo', {
          total: metadata.total,
          totalParsed: total,
          metadataKeys: Object.keys(metadata)
        });
        return;
      }
    }

    logger.info('Metadata validada para pago rechazado', {
      userId,
      total,
      metadataKeys: Object.keys(metadata)
    });

    // Crear la orden con status 'rejected'
    const newOrder = await db.insert(orders).values({
      userId,
      total: total.toString(),
      status: 'rejected',
      paymentId: payment.id.toString(),
      mercadoPagoId: payment.id.toString(),
      shippingAddress: null, // No incluir dirección de envío para rechazos
      shippingMethodId: null, // No incluir método de envío para rechazos
      shippingCost: '0.00',
    }).returning({ id: orders.id });

    const orderId = newOrder[0].id;
    logger.info('Orden rechazada creada exitosamente', { orderId, userId, paymentId: payment.id });

    // Nota: No crear items de orden para pagos rechazados, ya que no se procesaron

  } catch (error) {
    logger.error('Error procesando pago rechazado', {
      paymentId: payment.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      metadata: payment.metadata || {}
    });
    throw error;
  }
}
