import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const resolvedParams = await params;
    const orderId = parseInt(resolvedParams.id);
    if (Number.isNaN(orderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    const rows = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        shippingAgency: orders.shippingAgency,
        metadata: orders.metadata,
        mercadoLibreShipmentId: orders.mercadoLibreShipmentId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    const order = rows[0];

    if (session.user.role !== 'admin' && order.userId !== parseInt(session.user.id)) {
      logger.warn('Intento de acceso no autorizado a pickup status', {
        orderId,
        userId: session.user.id,
        orderUserId: order.userId,
      });
      return NextResponse.json({ error: 'Acceso denegado a esta orden' }, { status: 403 });
    }

    const metadata = (order.metadata ?? {}) as Record<string, unknown>;
    const pickupPostPayment = Boolean((metadata as { pickup_post_payment?: unknown }).pickup_post_payment);
    const shippingContextRaw = (metadata as { shipping_context?: unknown }).shipping_context;

    const shippingContext =
      shippingContextRaw && typeof shippingContextRaw === 'object'
        ? (shippingContextRaw as Record<string, unknown>)
        : {};

    const deliverTo =
      typeof shippingContext.deliver_to === 'string' ? shippingContext.deliver_to : null;

    const requiresPickupConfirmation = pickupPostPayment && deliverTo === 'agency';
    const pickupConfirmed = Boolean(order.shippingAgency);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      requiresPickupConfirmation,
      pickupConfirmed,
      shippingAgency: (order.shippingAgency ?? null) as unknown,
      shippingContext: {
        zipcode: typeof shippingContext.zipcode === 'string' ? shippingContext.zipcode : null,
        shipping_method_id:
          typeof shippingContext.shipping_method_id === 'string' ? shippingContext.shipping_method_id : null,
        shipping_method_name:
          typeof shippingContext.shipping_method_name === 'string' ? shippingContext.shipping_method_name : null,
        logistic_type:
          typeof shippingContext.logistic_type === 'string' ? shippingContext.logistic_type : null,
        deliver_to: deliverTo === 'agency' || deliverTo === 'address' ? (deliverTo as 'agency' | 'address') : null,
        carrier_id:
          typeof shippingContext.carrier_id === 'number' ? shippingContext.carrier_id : null,
        option_id:
          typeof shippingContext.option_id === 'number' ? shippingContext.option_id : null,
        option_hash:
          typeof shippingContext.option_hash === 'string' ? shippingContext.option_hash : null,
        state_id:
          typeof shippingContext.state_id === 'string' ? shippingContext.state_id : null,
      },
      mercadoLibreShipmentId: order.mercadoLibreShipmentId ?? null,
    });
  } catch (error) {
    logger.error('Error obteniendo estado de retiro', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
