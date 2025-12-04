// app/api/admin/payments/confirm/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { orders } from '@/lib/schema';
import { logger } from '@/lib/utils/logger';
import { requireAdminAuth, createAdminErrorResponse } from '@/lib/middleware/admin-auth';
import { applyRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limit';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    // Aplicar rate limiting antes de cualquier operación
    const rateLimitResult = await applyRateLimit(
      req, 
      RATE_LIMIT_CONFIGS.CRITICAL,
      'payment-confirm'
    );
    
    if (!rateLimitResult.success && rateLimitResult.response) {
      return rateLimitResult.response;
    }

    // Verificar autenticación de admin
    const { user } = await requireAdminAuth(req);
    
    const { paymentId, orderId, notes } = await req.json();

    if (!paymentId || !orderId) {
      return NextResponse.json(
        { error: 'Se requieren paymentId y orderId' },
        { status: 400 }
      );
    }

    logger.warn('[ADMIN] Confirmación manual de pago', {
      paymentId,
      orderId,
      notes,
      adminUser: user.email,
      userId: user.id,
      userAgent: req.headers.get('user-agent'),
      timestamp: new Date().toISOString(),
    });

    // Verificar que la orden existe y está pendiente
    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!existingOrder.length) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    const order = existingOrder[0];

    if (order.status === 'paid' || order.status === 'delivered') {
      return NextResponse.json(
        { error: 'La orden ya está pagada/completada', status: order.status },
        { status: 400 }
      );
    }

    // Actualizar estado de la orden a pagada
    await db
      .update(orders)
      .set({
        status: 'paid',
        paymentId: paymentId,
        paymentStatus: 'approved',
        updatedAt: new Date(),
        metadata: {
          ...(order.metadata as Record<string, unknown> || {}),
          manuallyConfirmed: true,
          manualConfirmationAt: new Date().toISOString(),
          manualConfirmationNotes: notes || 'Confirmación manual por admin',
          confirmedBy: user.email,
          confirmedById: user.id,
        },
      })
      .where(eq(orders.id, orderId));

    // Auditoría crítica de acción manual
    logger.error('[AUDIT-CRITICAL] Pago confirmado manualmente por admin', {
      orderId,
      paymentId,
      previousStatus: order.status,
      newStatus: 'paid',
      adminUser: user.email,
      userId: user.id,
      notes,
      timestamp: new Date().toISOString(),
      orderData: {
        total: order.total,
        userId: order.userId,
        createdAt: order.createdAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Pago confirmado manualmente',
      orderId,
      paymentId,
      previousStatus: order.status,
      newStatus: 'paid',
      confirmedBy: user.email,
      confirmedAt: new Date().toISOString(),
    });

  } catch (error) {
    // Error de autenticación
    if (error instanceof Error && error.message.includes('autorización')) {
      return createAdminErrorResponse(error.message);
    }

    logger.error('[ADMIN] Error en confirmación manual de pago', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { 
        error: 'Error confirmando pago manualmente',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET para listar órdenes pendientes de confirmación - AHORA SEGURO
export async function GET(req: NextRequest) {
  try {
    // Aplicar rate limiting
    const rateLimitResult = await applyRateLimit(
      req, 
      RATE_LIMIT_CONFIGS.READ,
      'payment-confirm-list'
    );
    
    if (!rateLimitResult.success && rateLimitResult.response) {
      return rateLimitResult.response;
    }

    // Verificar autenticación de admin
    const { user } = await requireAdminAuth(req);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    logger.info('[ADMIN] Listado de órdenes solicitado', {
      status,
      limit,
      offset,
      adminUser: user.email,
      userId: user.id,
    });

    const pendingOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.status, status as 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'rejected' | 'processing' | 'failed' | 'returned'))
      .limit(limit)
      .offset(offset)
      .orderBy(orders.createdAt);

    return NextResponse.json({
      success: true,
      orders: pendingOrders,
      count: pendingOrders.length,
      status,
      requestedBy: user.email,
      requestedAt: new Date().toISOString(),
    });

  } catch (error) {
    // Error de autenticación
    if (error instanceof Error && error.message.includes('autorización')) {
      return createAdminErrorResponse(error.message);
    }

    logger.error('[ADMIN] Error obteniendo órdenes pendientes', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error obteniendo órdenes' },
      { status: 500 }
    );
  }
}
