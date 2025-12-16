import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const shippingAgencySchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.object({
    street: z.string(),
    number: z.string(),
    city: z.string(),
    state: z.string(),
    zipcode: z.string(),
  }),
  phone: z.string(),
  hours: z.string(),
  carrier: z.object({
    id: z.string(),
    name: z.string(),
  }),
  coordinates: z.object({
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
  }),
});

const bodySchema = z.object({
  shippingAgency: shippingAgencySchema,
});

export async function POST(
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

    const payload = await request.json();
    const parsed = bodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const existing = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        shippingAgency: orders.shippingAgency,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    const order = existing[0];

    if (session.user.role !== 'admin' && order.userId !== parseInt(session.user.id)) {
      logger.warn('Intento de confirmación de retiro sin permisos', {
        orderId,
        userId: session.user.id,
        orderUserId: order.userId,
      });
      return NextResponse.json({ error: 'Acceso denegado a esta orden' }, { status: 403 });
    }

    if (order.shippingAgency) {
      return NextResponse.json({
        success: true,
        message: 'La sucursal ya fue confirmada previamente',
        alreadyConfirmed: true,
      });
    }

    await db
      .update(orders)
      .set({
        shippingAgency: parsed.data.shippingAgency,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    logger.info('Sucursal confirmada post-pago', {
      orderId,
      agencyId: parsed.data.shippingAgency.id,
      agencyName: parsed.data.shippingAgency.name,
    });

    return NextResponse.json({
      success: true,
      message: 'Sucursal confirmada correctamente',
    });
  } catch (error) {
    logger.error('Error confirmando sucursal post-pago', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
