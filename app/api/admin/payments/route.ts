// app/api/admin/payments/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { mercadopagoPayments } from '@/lib/schema';
import { logger } from '@/lib/utils/logger';
import { auth } from '@/lib/actions/auth';
import { eq, ilike, and, desc, count, or } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    // Verificar autenticación de administrador (mismo patrón que otros endpoints)
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      logger.warn('[ADMIN] Intento de acceso no autorizado', {
        path: req.url,
        userAgent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userId: session?.user?.id,
        userRole: session?.user?.role,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all';

    logger.info('[ADMIN] Listado de auditoría de pagos solicitado', {
      page,
      pageSize,
      search,
      filter,
      adminUser: session.user.email,
      userId: session.user.id,
    });

    // Construir condiciones de filtrado
    const conditions = [];

    // Filtro por estado de verificación manual
    switch (filter) {
      case 'requires_manual_verification':
        conditions.push(eq(mercadopagoPayments.requiresManualVerification, true));
        break;
      case 'hmac_valid':
        conditions.push(eq(mercadopagoPayments.hmacValidationResult, 'valid'));
        break;
      case 'hmac_fallback':
        conditions.push(eq(mercadopagoPayments.hmacValidationResult, 'fallback_used'));
        break;
      case 'approved':
        conditions.push(eq(mercadopagoPayments.status, 'approved'));
        break;
      case 'pending':
        conditions.push(eq(mercadopagoPayments.status, 'pending'));
        break;
      case 'rejected':
        conditions.push(eq(mercadopagoPayments.status, 'rejected'));
        break;
    }

    // Búsqueda por paymentId o externalReference
    if (search) {
      conditions.push(
        or(
          ilike(mercadopagoPayments.paymentId, `%${search}%`),
          ilike(mercadopagoPayments.externalReference, `%${search}%`)
        )
      );
    }

    // Obtener conteo total
    const totalCountQuery = db
      .select({ count: count() })
      .from(mercadopagoPayments);

    if (conditions.length > 0) {
      totalCountQuery.where(and(...conditions));
    }

    const [totalCountResult] = await totalCountQuery;
    const totalCount = totalCountResult.count;

    // Obtener pagos paginados
    const paymentsQuery = db
      .select({
        id: mercadopagoPayments.id,
        paymentId: mercadopagoPayments.paymentId,
        status: mercadopagoPayments.status,
        amount: mercadopagoPayments.amount,
        currencyId: mercadopagoPayments.currencyId,
        externalReference: mercadopagoPayments.externalReference,
        paymentMethodId: mercadopagoPayments.paymentMethodId,
        dateCreated: mercadopagoPayments.dateCreated,
        dateApproved: mercadopagoPayments.dateApproved,
        requiresManualVerification: mercadopagoPayments.requiresManualVerification,
        hmacValidationResult: mercadopagoPayments.hmacValidationResult,
        hmacFailureReason: mercadopagoPayments.hmacFailureReason,
        hmacFallbackUsed: mercadopagoPayments.hmacFallbackUsed,
        verificationTimestamp: mercadopagoPayments.verificationTimestamp,
        webhookRequestId: mercadopagoPayments.webhookRequestId,
        orderId: mercadopagoPayments.orderId,
      })
      .from(mercadopagoPayments);

    if (conditions.length > 0) {
      paymentsQuery.where(and(...conditions));
    }

    const payments = await paymentsQuery
      .orderBy(desc(mercadopagoPayments.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Formatear fechas para respuesta
    const formattedPayments = payments.map(payment => ({
      ...payment,
      dateCreated: payment.dateCreated?.toISOString() || '',
      dateApproved: payment.dateApproved?.toISOString() || null,
      verificationTimestamp: payment.verificationTimestamp?.toISOString() || null,
    }));

    return NextResponse.json({
      success: true,
      payments: formattedPayments,
      totalCount,
      page,
      pageSize,
      requestedBy: session.user.email,
      requestedAt: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('[ADMIN] Error obteniendo auditoría de pagos', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: 'Error obteniendo pagos' },
      { status: 500 }
    );
  }
}
