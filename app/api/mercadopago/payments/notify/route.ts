// app/api/mercadopago/payments/notify/route.ts
// DEPRECADO: Este endpoint ya no se usa para webhooks
// El procesamiento se hace directamente en /api/webhooks/mercadopago
// Este archivo se mantiene solo para consultas GET de pagos

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mercadopagoPayments } from '@/lib/schema';
import { eq, and, count } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

/**
 * POST - DEPRECADO
 * Los webhooks ahora se procesan directamente en /api/webhooks/mercadopago
 * usando el módulo payment-processor.ts
 */
export async function POST() {
  logger.warn('[DEPRECADO] POST a /api/mercadopago/payments/notify - usar /api/webhooks/mercadopago');
  
  return NextResponse.json({
    error: 'Endpoint deprecado',
    message: 'Los webhooks deben enviarse a /api/webhooks/mercadopago',
    redirect: '/api/webhooks/mercadopago',
  }, { status: 410 }); // 410 Gone
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('paymentId');
    const preferenceId = searchParams.get('preferenceId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (paymentId) {
      // Obtener pago específico
      const payment = await db.query.mercadopagoPayments.findFirst({
        where: eq(mercadopagoPayments.paymentId, paymentId),
        with: {
          order: true,
          preference: true,
        },
      });

      if (!payment) {
        return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
      }

      return NextResponse.json(payment);
    } else {
      // Obtener pagos con filtros
      const whereConditions = [];
      
      if (preferenceId) {
        whereConditions.push(eq(mercadopagoPayments.preferenceId, preferenceId));
      }
      
      if (status) {
        whereConditions.push(eq(mercadopagoPayments.status, status));
      }

      const whereCondition = whereConditions.length > 0 
        ? whereConditions.length === 1 
          ? whereConditions[0]
          : and(...whereConditions)
        : undefined;

      const payments = await db.query.mercadopagoPayments.findMany({
        where: whereCondition,
        with: {
          order: {
            columns: {
              id: true,
              total: true,
              status: true,
              createdAt: true,
            },
          },
          preference: {
            columns: {
              id: true,
              preferenceId: true,
              externalReference: true,
              status: true,
            },
          },
        },
        limit,
        offset,
        orderBy: (mercadopagoPayments, { desc }) => [
          desc(mercadopagoPayments.dateCreated),
        ],
      });

      // Obtener estadísticas
      const stats = await db
        .select({
          status: mercadopagoPayments.status,
          count: count(mercadopagoPayments.id),
        })
        .from(mercadopagoPayments)
        .groupBy(mercadopagoPayments.status);

      return NextResponse.json({
        payments,
        stats,
        pagination: {
          limit,
          offset,
          total: payments.length,
        },
      });
    }

  } catch (error) {
    logger.error('Error obteniendo pagos', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// NOTA: Las funciones de procesamiento de pagos se movieron a:
// lib/actions/payment-processor.ts
