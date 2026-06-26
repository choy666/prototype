import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { cancelOrder } from '@/lib/actions/orders';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/utils/logger';

const cancelOrderSchema = z.object({
  reason: z.string().min(10, 'La justificación debe tener al menos 10 caracteres').max(500, 'La justificación no puede exceder 500 caracteres'),
});

export async function POST(
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

    const { id: orderId } = await params;
    const orderIdNum = parseInt(orderId);

    if (isNaN(orderIdNum)) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = cancelOrderSchema.parse(body);

    logger.info('Order cancellation initiated', {
      orderId: orderIdNum,
      userId: session.user.id,
      reason: validatedData.reason.substring(0, 100) + '...',
    });

    const cancelledOrder = await cancelOrder(
      orderIdNum,
      parseInt(session.user.id),
      validatedData.reason
    );

    if (!cancelledOrder) {
      return NextResponse.json(
        { error: 'No se pudo cancelar la orden' },
        { status: 500 }
      );
    }

    logger.info('Order cancelled successfully', {
      orderId: orderIdNum,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Orden cancelada exitosamente',
      order: {
        id: cancelledOrder.id,
        status: cancelledOrder.status,
        cancelledAt: cancelledOrder.cancelledAt,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation error during order cancellation', {
        userId: (await auth())?.user?.id,
        orderId: await params.then(p => p.id),
        issues: error.issues,
      });
      return NextResponse.json({
        error: 'Error de validación',
        details: error.issues.map(issue => issue.message).join(', '),
      }, { status: 400 });
    }

    logger.error('Unexpected error during order cancellation', {
      userId: (await auth())?.user?.id,
      orderId: await params.then(p => p.id),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
