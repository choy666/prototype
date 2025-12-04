import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { processPaymentWebhook } from '@/lib/actions/payment-processor';

/**
 * Endpoint de fallback para procesar pagos exitosos cuando webhooks fallan
 * Se activa desde la página de éxito con los parámetros de Mercado Pago
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { payment_id, merchant_order_id, external_reference, status, collection_status } = body;

    logger.info('[SUCCESS-FALLBACK] Procesando pago vía success page', {
      payment_id,
      merchant_order_id,
      external_reference,
      status,
      collection_status,
    });

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

    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 });
  }
}
