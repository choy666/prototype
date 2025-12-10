import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { processPaymentWebhook, checkPaymentIdempotency } from '@/lib/actions/payment-processor';

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

    // 🔥 MEJORADO: Usar mismo sistema de idempotencia que HMAC-FALLBACK
    try {
      const idemCheck = await checkPaymentIdempotency(String(payment_id));
      
      if (!idemCheck.canProcess) {
        logger.info('[SUCCESS-FALLBACK] Pago duplicado detectado por idempotency check', {
          payment_id,
          reason: idemCheck.reason,
          existingStatus: idemCheck.existingStatus,
          source: 'idempotency_check',
        });

        return NextResponse.json({
          success: true,
          message: 'Pago ya procesado previamente',
          status: idemCheck.existingStatus,
          alreadyProcessed: true,
          source: 'idempotency_check',
        });
      }
    } catch (idempotencyError) {
      logger.error('[SUCCESS-FALLBACK] Error en idempotency check', {
        payment_id,
        error: idempotencyError instanceof Error ? idempotencyError.message : String(idempotencyError),
      });
      // Continuar con procesamiento normal si falla la verificación
    }

    // 🔥 ESTRATEGIA: Reducir delay a 100ms para balancear race conditions y UX
    // Más rápido pero aún da prioridad al webhook original
    await new Promise(resolve => setTimeout(resolve, 100));
    
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
