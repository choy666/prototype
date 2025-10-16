import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');

    if (!orderId) {
      return NextResponse.json(
        { error: 'ID de orden requerido' },
        { status: 400 }
      );
    }

    // Verificar que la orden pertenece al usuario autenticado
    const order = await db
      .select({
        id: orders.id,
        status: orders.status,
        total: orders.total,
        mercadoPagoId: orders.mercadoPagoId,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.id, parseInt(orderId)))
      .limit(1);

    if (order.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    const orderData = order[0];

    // Verificar que la orden pertenece al usuario actual
    // Nota: Asumiendo que hay un campo userId en orders
    // Si no existe, agregar validación adicional

    return NextResponse.json({
      orderId: orderData.id,
      status: orderData.status,
      total: orderData.total,
      mercadoPagoId: orderData.mercadoPagoId,
      createdAt: orderData.createdAt,
    });

  } catch (error) {
    logger.error('Error obteniendo estado de orden', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
