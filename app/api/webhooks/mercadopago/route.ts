import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '@/lib/db';
import { orders, orderItems, products } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/utils/logger';

interface MercadoPagoWebhookBody {
  data: {
    id: string;
  };
}

interface MercadoPagoPaymentData {
  external_reference: string;
  status: string;
}

// Configurar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

export async function POST(request: NextRequest) {
  let body: MercadoPagoWebhookBody | null = null;
  const userAgent = '';
  const ip = 'unknown';

  try {
    // Verificar rate limiting para webhooks (más permisivo ya que vienen de MP)
    const rateLimitResponse = checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    body = await request.json();
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // Verificar firma del webhook
    const signature = request.headers.get('x-signature');
    const timestamp = request.headers.get('x-request-id'); // Mercado Pago usa x-request-id para timestamp

    if (!signature || !timestamp) {
      logger.warn('Firma o timestamp faltante en webhook MP', { ip });
      return NextResponse.json({ error: 'Missing signature or timestamp' }, { status: 401 });
    }

    // Verificar timestamp para prevenir replay attacks (5 minutos de tolerancia)
    const requestTimestamp = parseInt(timestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - requestTimestamp);

    if (timeDiff > 300) { // 5 minutos
      logger.warn('Timestamp expirado en webhook MP', { ip, timeDiff });
      return NextResponse.json({ error: 'Expired timestamp' }, { status: 401 });
    }

    // Verificar firma HMAC-SHA256
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('MERCADO_PAGO_WEBHOOK_SECRET no configurado');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const payload = JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Firma inválida en webhook MP', { ip });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Logging de seguridad
    logger.info('Webhook MP verificado', { ip, userAgent, paymentId: body?.data?.id || 'unknown' });

    // Verificar que sea una notificación de Mercado Pago
    if (!body || !body.data || !body.data.id) {
      logger.warn('Datos de webhook inválidos', { ip });
      return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
    }

    const paymentId = body.data.id;

    // Obtener detalles del pago desde Mercado Pago
    const payment = new Payment(client);
    const paymentData = await payment.get({ id: paymentId }) as MercadoPagoPaymentData | null;

    if (!paymentData) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Buscar la orden por el external_reference
    const orderId = paymentData.external_reference;
    if (!orderId) {
      return NextResponse.json({ error: 'No order reference' }, { status: 400 });
    }

    // Actualizar el estado de la orden basado en el estado del pago
    let orderStatus: 'pending' | 'paid' | 'cancelled' = 'pending';

    switch (paymentData.status) {
      case 'approved':
        orderStatus = 'paid';
        break;
      case 'cancelled':
      case 'rejected':
        orderStatus = 'cancelled';
        break;
      default:
        orderStatus = 'pending';
    }

    // Actualizar la orden en la base de datos
    await db
      .update(orders)
      .set({
        status: orderStatus,
        paymentId: paymentId.toString(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, parseInt(orderId)));

    // Gestionar stock basado en el estado del pago
    if (orderStatus === 'paid') {
      // El stock ya fue reservado en checkout, no hacer nada adicional
      logger.info('Pago aprobado - stock ya reservado en checkout', { orderId });
    } else if (orderStatus === 'cancelled') {
      // Rollback: devolver stock reservado con retry logic para errores temporales
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const orderItemsData = await db
            .select({
              productId: orderItems.productId,
              quantity: orderItems.quantity,
            })
            .from(orderItems)
            .where(eq(orderItems.orderId, parseInt(orderId)));

          // Incrementar stock de productos en transacción
          await db.transaction(async (tx) => {
            for (const item of orderItemsData) {
              await tx
                .update(products)
                .set({
                  stock: sql`${products.stock} + ${item.quantity}`,
                  updated_at: new Date(),
                })
                .where(eq(products.id, item.productId));
            }
          });

          logger.info('Stock devuelto por pago cancelado', {
            orderId,
            itemCount: orderItemsData.length,
            totalStockReturned: orderItemsData.reduce((sum, item) => sum + item.quantity, 0),
            retryCount
          });
          break; // Éxito, salir del loop

        } catch (error) {
          retryCount++;
          logger.warn(`Error en rollback de stock (intento ${retryCount}/${maxRetries})`, {
            orderId,
            error: error instanceof Error ? error.message : String(error)
          });

          if (retryCount >= maxRetries) {
            logger.error('Rollback de stock falló después de todos los reintentos', {
              orderId,
              error: error instanceof Error ? error.message : String(error)
            });
            // Podríamos enviar alerta aquí para intervención manual
          } else {
            // Esperar antes del siguiente retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          }
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    // Categorizar errores para mejor debugging
    let errorType = 'unknown';
    let statusCode = 500;
    let errorMessage = 'Error interno del servidor';
    let paymentId = 'unknown';

    // Extraer variables del scope si están disponibles
    try {
      if (typeof body !== 'undefined' && body && body.data && body.data.id) {
        paymentId = body.data.id;
      }
      // ip y userAgent ya están definidos en el try principal
    } catch {
      // Variables no disponibles, usar defaults
    }

    if (error instanceof Error) {
      if (error.message.includes('signature') || error.message.includes('timestamp')) {
        errorType = 'security';
        statusCode = 401;
        errorMessage = 'Error de seguridad en webhook';
      } else if (error.message.includes('Payment not found') || error.message.includes('No order reference')) {
        errorType = 'validation';
        statusCode = 400;
        errorMessage = 'Datos de pago inválidos';
      } else if (error.message.includes('database') || error.message.includes('connection')) {
        errorType = 'database';
        statusCode = 500;
        errorMessage = 'Error de base de datos';
      } else {
        errorType = 'processing';
      }

      logger.error('Error procesando webhook de Mercado Pago', {
        errorType,
        error: error.message,
        stack: error.stack,
        paymentId,
        ip,
        userAgent
      });
    } else {
      logger.error('Error desconocido en webhook MP', {
        error: String(error),
        paymentId,
        ip
      });
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
