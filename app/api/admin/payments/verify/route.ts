// app/api/admin/payments/verify/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { mercadopagoPayments, orders } from '@/lib/schema';
import { logger } from '@/lib/utils/logger';
import { requireAdminAuth, createAdminErrorResponse } from '@/lib/middleware/admin-auth';
import { applyRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limit';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    // Aplicar rate limiting más estricto para acciones críticas
    const rateLimitResult = await applyRateLimit(
      req, 
      RATE_LIMIT_CONFIGS.CRITICAL,
      'payment-verify'
    );
    
    if (!rateLimitResult.success && rateLimitResult.response) {
      return rateLimitResult.response;
    }

    // Verificar autenticación de admin
    const { user } = await requireAdminAuth(req);
    
    const { paymentId } = await req.json();

    if (!paymentId) {
      return NextResponse.json(
        { error: 'Se requiere paymentId' },
        { status: 400 }
      );
    }

    logger.warn('[ADMIN] Verificación manual de pago HMAC', {
      paymentId,
      adminUser: user.email,
      userId: user.id,
      userAgent: req.headers.get('user-agent'),
      timestamp: new Date().toISOString(),
    });

    // Obtener el pago y su orden asociada
    const paymentData = await db
      .select({
        payment: mercadopagoPayments,
        order: orders,
      })
      .from(mercadopagoPayments)
      .leftJoin(orders, eq(mercadopagoPayments.orderId, orders.id))
      .where(eq(mercadopagoPayments.paymentId, paymentId))
      .limit(1);

    if (!paymentData.length) {
      return NextResponse.json(
        { error: 'Pago no encontrado' },
        { status: 404 }
      );
    }

    const { payment, order } = paymentData[0];

    if (!payment.requiresManualVerification) {
      return NextResponse.json(
        { error: 'Este pago no requiere verificación manual' },
        { status: 400 }
      );
    }

    // Verificar que el pago esté aprobado en Mercado Pago
    if (payment.status !== 'approved') {
      return NextResponse.json(
        { error: `Solo se pueden verificar pagos aprobados. Estado actual: ${payment.status}` },
        { status: 400 }
      );
    }

    // Actualizar el pago para marcarlo como verificado
    await db
      .update(mercadopagoPayments)
      .set({
        requiresManualVerification: false,
        hmacValidationResult: 'manually_verified',
        verificationTimestamp: new Date(),
      })
      .where(eq(mercadopagoPayments.paymentId, paymentId));

    // Si hay una orden asociada, actualizarla a 'paid'
    if (order) {
      await db
        .update(orders)
        .set({
          status: 'paid',
          paymentId: paymentId,
          mercadoPagoId: paymentId,
          updatedAt: new Date(),
          metadata: {
            ...(order.metadata as Record<string, unknown> || {}),
            hmacManuallyVerified: true,
            manualVerificationAt: new Date().toISOString(),
            verifiedBy: user.email,
            verifiedById: user.id,
            originalHmacResult: payment.hmacValidationResult,
            originalHmacFailure: payment.hmacFailureReason,
          },
        })
        .where(eq(orders.id, order.id));

      logger.info('[ADMIN] Orden actualizada tras verificación manual', {
        orderId: order.id,
        paymentId,
        previousStatus: order.status,
        newStatus: 'paid',
        adminUser: user.email,
      });
    }

    // Auditoría crítica de acción manual
    logger.error('[AUDIT-CRITICAL] Pago HMAC verificado manualmente por admin', {
      paymentId,
      orderId: order?.id,
      previousHmacResult: payment.hmacValidationResult,
      previousHmacFailure: payment.hmacFailureReason,
      newHmacResult: 'manually_verified',
      adminUser: user.email,
      userId: user.id,
      paymentAmount: payment.amount,
      paymentCurrency: payment.currencyId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Pago verificado manualmente',
      paymentId,
      orderId: order?.id,
      previousStatus: order?.status,
      newStatus: order ? 'paid' : 'no_order',
      verifiedBy: user.email,
      verifiedAt: new Date().toISOString(),
    });

  } catch (error) {
    // Error de autenticación
    if (error instanceof Error && error.message.includes('autorización')) {
      return createAdminErrorResponse(error.message);
    }

    logger.error('[ADMIN] Error en verificación manual de pago', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { 
        error: 'Error verificando pago manualmente',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
