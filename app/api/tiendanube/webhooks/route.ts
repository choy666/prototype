import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores, tiendanubeWebhooksRaw, tiendanubeCustomerMapping, tiendanubeProductMapping, users, orders, orderItems } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import crypto from 'crypto';
import { getTiendanubeConfig } from '@/lib/config/integrations';
import { WebhookRetryService } from '@/lib/services/tiendanube/webhook-retries';

interface TiendanubeWebhookPayload {
  event: string;
  data: unknown;
  store_id: string;
}

interface TiendanubeOrder {
  id: string | number;
  number?: string;
  customer?: {
    id?: string | number;
    email?: string;
    name?: string;
  };
  shipping_address?: {
    address?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    country?: string;
    name?: string;
    phone?: string;
  };
  total?: string | number;
  paid?: boolean;
  shipping_cost?: string | number;
  shipping_id?: string | number;
  created_at?: string;
  paid_at?: string;
  payment_method?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  products?: Array<{
    sku?: string;
    quantity?: number;
    price?: string | number;
  }>;
}

async function validateHmac(body: string, signature: string, secret: string): Promise<boolean> {
  if (!signature) {
    logger.warn('Webhook sin firma HMAC');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');

  // Tiendanube envía el HMAC en base64 o hex según configuración
  // Asumimos hex por defecto, pero podríamos necesitar decodificar base64
  const receivedSignature = signature.startsWith('sha256=') 
    ? signature.replace('sha256=', '')
    : signature;

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receivedSignature, 'hex')
  );

  if (!isValid) {
    logger.error('HMAC inválido', {
      expected: expectedSignature,
      received: receivedSignature,
    });
  }

  return isValid;
}

async function persistWebhookRaw(
  storeId: string,
  event: string,
  body: string,
  headers: Record<string, string>,
  processed: boolean = false
): Promise<number | null> {
  try {
    const [webhook] = await db.insert(tiendanubeWebhooksRaw).values({
      storeId,
      event,
      rawBody: body,
      headers,
      processed,
      status: processed ? 'processed' : 'pending',
      createdAt: new Date(),
    }).returning();
    return webhook.id;
  } catch (error) {
    logger.error('Error persistiendo webhook raw', {
      storeId,
      event,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function handleStoreRedact(storeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Para LGPD, eliminar datos sensibles de la tienda
    await db
      .update(tiendanubeStores)
      .set({
        status: 'redacted',
        updatedAt: new Date(),
      })
      .where(eq(tiendanubeStores.storeId, storeId));

    logger.info('Datos de tienda redactados por LGPD', { storeId });
    return { success: true };
  } catch (error) {
    logger.error('Error redactando tienda', {
      storeId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleCustomersRedact(storeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Para LGPD, eliminar o anonimizar datos de clientes
    // Esto podría implicar actualizar la tabla users o una tabla específica de clientes
    logger.info('Solicitud de redacción de clientes recibida', { storeId });
    // TODO: Implementar lógica de redacción de clientes
    return { success: true };
  } catch (error) {
    logger.error('Error redactando clientes', {
      storeId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleCustomersDataRequest(storeId: string, _data: unknown): Promise<{ success: boolean; error?: string }> {
  try {
    // Para LGPD, exportar todos los datos del cliente
    const customerData = typeof _data === 'object' && _data !== null ? (_data as { customer_id?: string | number }) : undefined;
    const customerId = customerData?.customer_id;
    logger.info('Solicitud de datos de cliente recibida', { storeId, customerId });
    // TODO: Implementar lógica de exportación de datos de cliente
    return { success: true };
  } catch (error) {
    logger.error('Error procesando solicitud de datos de cliente', {
      storeId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleAppUninstalled(storeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(tiendanubeStores)
      .set({
        status: 'uninstalled',
        uninstalledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tiendanubeStores.storeId, storeId));

    logger.info('App desinstalada', { storeId });
    return { success: true };
  } catch (error) {
    logger.error('Error procesando desinstalación', {
      storeId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleOrderPaid(storeId: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  try {
    const order = data as TiendanubeOrder;
    if (!order?.id) {
      return { success: false, error: 'Orden sin ID' };
    }

    // Buscar la orden local por el ID de Tiendanube
    const localOrder = await db.query.orders.findFirst({
      where: eq(orders.tiendanubeOrderId, order.id.toString()),
    });

    if (!localOrder) {
      logger.warn('Orden no encontrada para actualizar pago', {
        storeId,
        tiendanubeOrderId: order.id,
      });
      return { success: true }; // No es error, puede ser una orden antigua
    }

    // Actualizar estado de pago
    await db
      .update(orders)
      .set({
        paymentStatus: 'paid',
        status: 'processing', // Cambiar a processing cuando está pagada
        updatedAt: new Date(),
        metadata: {
          ...(localOrder.metadata || {}),
          paidAt: order.paid_at || new Date().toISOString(),
          paymentMethod: order.payment_method || 'unknown',
        },
      })
      .where(eq(orders.id, localOrder.id));

    logger.info('Orden marcada como pagada', {
      storeId,
      orderId: localOrder.id,
      tiendanubeOrderId: order.id,
    });

    // TODO: Opcional - Enviar email de confirmación de pago
    // TODO: Opcional - Actualizar inventario si es necesario

    return { success: true };
  } catch (error) {
    logger.error('Error actualizando orden pagada', {
      storeId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleOrderCancelled(storeId: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  try {
    const order = data as TiendanubeOrder;
    if (!order?.id) {
      return { success: false, error: 'Orden sin ID' };
    }

    // Buscar la orden local por el ID de Tiendanube
    const localOrder = await db.query.orders.findFirst({
      where: eq(orders.tiendanubeOrderId, order.id.toString()),
    });

    if (!localOrder) {
      logger.warn('Orden no encontrada para cancelar', {
        storeId,
        tiendanubeOrderId: order.id,
      });
      return { success: true }; // No es error, puede ser una orden antigua
    }

    // Actualizar estado de la orden
    await db
      .update(orders)
      .set({
        status: 'cancelled',
        paymentStatus: order.paid ? 'refunded' : 'cancelled',
        updatedAt: new Date(),
        metadata: {
          ...(localOrder.metadata || {}),
          cancelledAt: order.cancelled_at || new Date().toISOString(),
          cancelReason: order.cancel_reason || 'Cancelled in Tiendanube',
        },
      })
      .where(eq(orders.id, localOrder.id));

    logger.info('Orden cancelada', {
      storeId,
      orderId: localOrder.id,
      tiendanubeOrderId: order.id,
      paymentStatus: order.paid ? 'refunded' : 'cancelled',
    });

    // TODO: Opcional - Devolver stock al inventario
    // TODO: Opcional - Enviar email de cancelación
    // TODO: Opcional - Procesar reembolso si aplica

    return { success: true };
  } catch (error) {
    logger.error('Error cancelando orden', {
      storeId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleOrderCreated(storeId: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  try {
    const order = data as TiendanubeOrder;
    if (!order?.id) {
      return { success: false, error: 'Orden sin ID' };
    }

    // Verificar idempotencia: si la orden ya existe, ignorar
    const existingOrder = await db.query.orders.findFirst({
      where: eq(orders.tiendanubeOrderId, order.id.toString()),
    });

    if (existingOrder) {
      logger.info('Orden ya existe, ignorando webhook duplicado', {
        storeId,
        tiendanubeOrderId: order.id,
        localOrderId: existingOrder.id,
      });
      return { success: true };
    }

    // Extraer datos del cliente
    const customer = order.customer || {};
    const customerEmail = customer.email;
    
    if (!customerEmail) {
      return { success: false, error: 'Orden sin email de cliente' };
    }

    // Buscar o crear usuario local
    let localUser = await db.query.users.findFirst({
      where: eq(users.email, customerEmail),
    });

    if (!localUser) {
      // Crear usuario sin password (para cumplir userId NOT NULL)
      const [newUser] = await db.insert(users).values({
        email: customerEmail,
        name: customer.name || customerEmail,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      localUser = newUser;
      logger.info('Usuario creado desde Tiendanube', { userId: localUser.id, email: customerEmail });
    }

    // Guardar mapeo de cliente
    await db.insert(tiendanubeCustomerMapping).values({
      storeId,
      tiendanubeCustomerId: customer.id?.toString() || 'unknown',
      userId: localUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [tiendanubeCustomerMapping.storeId, tiendanubeCustomerMapping.tiendanubeCustomerId],
      set: { updatedAt: new Date() },
    });

    // Extraer datos de envío
    const shippingAddress = order.shipping_address ? {
      address: order.shipping_address.address || '',
      city: order.shipping_address.city || '',
      province: order.shipping_address.province || '',
      postalCode: order.shipping_address.postal_code || '',
      country: order.shipping_address.country || '',
      name: order.shipping_address.name || customer.name || '',
      phone: order.shipping_address.phone || '',
    } : null;

    // Crear orden local
    const [newOrder] = await db.insert(orders).values({
      userId: localUser.id,
      email: customerEmail,
      total: order.total?.toString() || '0',
      status: 'pending',
      paymentStatus: order.paid ? 'paid' : 'pending',
      shippingAddress,
      shippingCost: order.shipping_cost?.toString() || '0',
      tiendanubeStoreId: storeId,
      tiendanubeOrderId: order.id.toString(),
      tiendanubeShippingId: order.shipping_id?.toString(),
      source: 'tiendanube',
      metadata: {
        tiendanubeOrderNumber: order.number,
        tiendanubeCreatedAt: order.created_at,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Sincronizar items
    const items = order.products || [];
    for (const item of items) {
      // Buscar producto por SKU en el mapping
      const mapping = await db.query.tiendanubeProductMapping.findFirst({
        where: and(
          eq(tiendanubeProductMapping.storeId, storeId),
          eq(tiendanubeProductMapping.sku, item.sku || '')
        ),
      });

      if (!mapping) {
        logger.warn('Producto no mapeado encontrado', {
          storeId,
          sku: item.sku,
          orderId: order.id,
        });
        // Podríamos crear el item con productId null para revisión manual
        continue;
      }

      await db.insert(orderItems).values({
        orderId: newOrder.id,
        productId: mapping.localProductId,
        variantId: mapping.localVariantId,
        quantity: item.quantity || 1,
        price: item.price?.toString() || '0',
        createdAt: new Date(),
      });
    }

    logger.info('Orden sincronizada desde Tiendanube', {
      storeId,
      orderId: order.id,
      localOrderId: newOrder.id,
      itemCount: items.length,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error sincronizando orden', {
      storeId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  let webhookRawId: number | null = null;

  try {
    const body = await req.text();
    const payload: TiendanubeWebhookPayload = JSON.parse(body);

    // Recolectar headers relevantes
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    logger.info('Webhook de Tiendanube recibido', {
      event: payload.event,
      storeId: payload.store_id,
    });

    // Validar que la tienda exista
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, payload.store_id),
    });

    if (!store) {
      logger.error('Webhook de tienda no registrada', {
        storeId: payload.store_id,
      });
      return NextResponse.json({ error: 'Tienda no registrada' }, { status: 404 });
    }

    // Validar HMAC
    const config = getTiendanubeConfig();
    const hmacSignature = req.headers.get('x-linkedstore-hmac-sha256');
    
    if (!config.clientSecret) {
      logger.error('Client secret no configurado para validación HMAC');
      return NextResponse.json({ error: 'Configuración inválida' }, { status: 500 });
    }

    const isValidHmac = await validateHmac(body, hmacSignature || '', config.clientSecret);
    if (!isValidHmac) {
      // Persistir webhook sin procesar para posible retry manual
      webhookRawId = await persistWebhookRaw(payload.store_id, payload.event, body, headers, false);
      return NextResponse.json({ error: 'HMAC inválido' }, { status: 401 });
    }

    // Persistir webhook raw antes de procesar
    webhookRawId = await persistWebhookRaw(payload.store_id, payload.event, body, headers, true);

    // Manejar eventos según tipo
    let result: { success: boolean; error?: string } = { success: true };

    switch (payload.event) {
      case 'store/redact':
        result = await handleStoreRedact(payload.store_id);
        break;
      case 'customers/redact':
        result = await handleCustomersRedact(payload.store_id);
        break;
      case 'customers/data_request':
        result = await handleCustomersDataRequest(payload.store_id, payload.data);
        break;
      case 'app/uninstalled':
        result = await handleAppUninstalled(payload.store_id);
        break;
      case 'order/created':
        result = await handleOrderCreated(payload.store_id, payload.data);
        break;
      case 'order/paid':
        result = await handleOrderPaid(payload.store_id, payload.data);
        break;
      case 'order/cancelled':
        result = await handleOrderCancelled(payload.store_id, payload.data);
        break;
      case 'product/created':
      case 'product/updated':
        // TODO: Implementar cuando se necesite sync de productos
        logger.info('Evento de producto recibido', { 
          storeId: payload.store_id, 
          event: payload.event 
        });
        break;
      default:
        logger.warn('Evento de webhook no manejado', {
          event: payload.event,
          storeId: payload.store_id,
        });
    }

    const duration = Date.now() - startTime;
    logger.info('Webhook procesado', {
      event: payload.event,
      storeId: payload.store_id,
      success: result.success,
      duration: `${duration}ms`,
    });

    if (!result.success) {
      // Si falló el procesamiento, programar retry si tenemos el ID
      if (webhookRawId) {
        await WebhookRetryService.scheduleRetry(webhookRawId, result.error || 'Error desconocido');
      }
      return NextResponse.json(
        { error: result.error || 'Error procesando webhook' },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Error procesando webhook de Tiendanube', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration}ms`,
    });

    // Programar retry si tenemos el ID del webhook
    if (webhookRawId) {
      await WebhookRetryService.scheduleRetry(webhookRawId, errorMessage);
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Endpoint para re-procesar webhooks (para admin/debug)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');
  const eventId = searchParams.get('eventId');
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    const webhooks = await db.query.tiendanubeWebhooksRaw.findMany({
      where: storeId 
        ? eq(tiendanubeWebhooksRaw.storeId, storeId)
        : eventId
        ? eq(tiendanubeWebhooksRaw.id, parseInt(eventId))
        : undefined,
      orderBy: (tiendanubeWebhooksRaw, { desc }) => [
        desc(tiendanubeWebhooksRaw.createdAt)
      ],
      limit,
    });

    return NextResponse.json({ webhooks });
  } catch (error) {
    logger.error('Error obteniendo webhooks raw', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Error obteniendo webhooks' },
      { status: 500 }
    );
  }
}
