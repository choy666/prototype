import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { processPaymentWebhook } from '@/lib/actions/payment-processor';
import { db } from '@/lib/db';

/**
 * Endpoint de fallback para procesar pagos exitosos cuando webhooks fallan
 * Se activa desde la página de éxito con los parámetros de Mercado Pago
 */
export async function POST(req: Request) {
  const { payment_id, merchant_order_id, external_reference, status, collection_status } = await req.json();

  logger.info('[SUCCESS-FALLBACK] Procesando pago vía success page', {
    payment_id,
    merchant_order_id,
    external_reference,
    status,
    collection_status,
  });

  try {
    // Validar que sea un pago aprobado
    if (status !== 'approved' && collection_status !== 'approved') {
      return NextResponse.json({
        success: false,
        error: 'El pago no está aprobado',
      }, { status: 400 });
    }

    if (!payment_id) {
      return NextResponse.json({
        success: false,
        error: 'Falta payment_id',
      }, { status: 400 });
    }

    // PROTECCIÓN DE IDEMPOTENCIA: Verificar si el pago ya fue procesado
    try {
      const existingPayment = await db.query.mercadopagoPayments.findFirst({
        where: (payments, { eq }) => eq(payments.paymentId, String(payment_id)),
      });

      if (existingPayment) {
        logger.info('[SUCCESS-FALLBACK] Pago ya procesado, retornando éxito idempotente', {
          payment_id,
          existingStatus: existingPayment.status,
          existingOrderId: existingPayment.orderId,
          source: 'db_check',
        });

        return NextResponse.json({
          success: true,
          message: 'Pago ya procesado previamente',
          status: existingPayment.status,
          alreadyProcessed: true,
          source: 'db_check',
        });
      }
    } catch (dbError) {
      logger.error('[SUCCESS-FALLBACK] Error verificando pago existente', {
        payment_id,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
      // Continuar con procesamiento normal si falla la verificación
    }

    // 🔥 ESTRATEGIA: Dar prioridad al webhook original (delay de 200ms)
    // Esto reduce race conditions y dead letter queue
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Procesar el pago usando el mismo processor que los webhooks
    const result = await processPaymentWebhook(String(payment_id), 'success-page-fallback');

    if (result.success) {
      logger.info('[SUCCESS-FALLBACK] Pago procesado exitosamente', {
        payment_id,
        status: result.status,
      });

      return NextResponse.json({
        success: true,
        message: 'Pago procesado correctamente',
        status: result.status,
      });
    } else {
      logger.error('[SUCCESS-FALLBACK] Error procesando pago', {
        payment_id,
        error: result.error,
      });

      return NextResponse.json({
        success: false,
        error: result.error || 'Error procesando el pago',
      }, { status: 500 });
    }

  } catch (error) {
    logger.error('[SUCCESS-FALLBACK] Error interno', {
      error: error instanceof Error ? error.message : String(error),
    });

    // MANEJO ESPECIAL: Violación de constraint único (pago duplicado)
    if (error instanceof Error && (error.message.includes('unique constraint') || 
        (error as { code?: string })?.code === '23505' || 
        (error as { detail?: string })?.detail?.includes('already exists'))) {
      
      logger.info('[SUCCESS-FALLBACK] Pago duplicado detectado por constraint, tratando como éxito idempotente', {
        payment_id,
        error: (error as Error).message,
        source: 'constraint_violation',
      });

      return NextResponse.json({
        success: true,
        message: 'Pago ya procesado (detectado por constraint)',
        status: 'paid',
        alreadyProcessed: true,
        duplicateDetected: true,
        source: 'constraint_violation',
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 });
  }
}
