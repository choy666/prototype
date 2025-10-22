import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const updateTrackingSchema = z.object({
  trackingNumber: z.string().min(1, 'El número de seguimiento es requerido').max(100, 'El número de seguimiento es demasiado largo'),
});

// PUT /api/orders/[id]/tracking - Actualizar número de seguimiento
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar rate limiting
    const rateLimitResponse = checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;

    // Solo administradores pueden actualizar tracking numbers
    if (session.user.role !== 'admin') {
      logger.warn('Intento de actualizar tracking number sin permisos de admin', {
        userId: session.user.id,
        orderId: resolvedParams.id
      });
      return NextResponse.json(
        { error: 'Acceso denegado. Solo administradores pueden actualizar números de seguimiento' },
        { status: 403 }
      );
    }

    const orderId = parseInt(resolvedParams.id);
    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    // Validar el body de la request
    const body = await request.json();
    const validationResult = updateTrackingSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { trackingNumber } = validationResult.data;

    // Verificar que la orden existe
    const existingOrder = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (existingOrder.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    // Actualizar el tracking number y cambiar el estado a 'shipped' si no lo está
    const updateData: {
      trackingNumber: string;
      updatedAt: Date;
      status?: 'shipped';
    } = {
      trackingNumber,
      updatedAt: new Date(),
    };

    // Si la orden está en estado 'paid', cambiarla a 'shipped'
    if (existingOrder[0].status === 'paid') {
      updateData.status = 'shipped';
    }

    const updatedOrder = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId))
      .returning({
        id: orders.id,
        status: orders.status,
        trackingNumber: orders.trackingNumber,
        updatedAt: orders.updatedAt,
      });

    logger.info('Número de seguimiento actualizado', {
      orderId,
      trackingNumber,
      adminId: session.user.id
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder[0],
      message: 'Número de seguimiento actualizado exitosamente'
    });

  } catch (error) {
    logger.error('Error actualizando número de seguimiento', {
      error: error instanceof Error ? error.message : String(error),
      orderId: (await params).id
    });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET /api/orders/[id]/tracking - Obtener número de seguimiento
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const orderId = parseInt(resolvedParams.id);
    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    // Obtener la orden y verificar permisos
    const order = await db
      .select({
        id: orders.id,
        trackingNumber: orders.trackingNumber,
        status: orders.status,
        userId: orders.userId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (order.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    const orderData = order[0];

    // Verificar que el usuario tenga acceso a esta orden
    if (orderData.userId !== parseInt(session.user.id) && session.user.role !== 'admin') {
      logger.warn('Intento de acceso no autorizado al tracking number', {
        orderId,
        userId: session.user.id,
        orderUserId: orderData.userId
      });
      return NextResponse.json(
        { error: 'Acceso denegado a esta orden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      orderId: orderData.id,
      trackingNumber: orderData.trackingNumber,
      status: orderData.status,
    });

  } catch (error) {
    logger.error('Error obteniendo número de seguimiento', {
      error: error instanceof Error ? error.message : String(error),
      orderId: (await params).id
    });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
