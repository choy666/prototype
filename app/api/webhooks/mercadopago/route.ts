/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/webhooks/mercadopago/route.ts
// UNIFICADO: Procesa webhooks directamente sin doble salto

import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { verifyWebhookSignature, validateWebhookPayload } from '@/lib/mercado-pago/hmacVerifier-fixed';
import { saveDeadLetterWebhook } from '@/lib/actions/webhook-failures';
import { processPaymentWebhook, checkPaymentIdempotency } from '@/lib/actions/payment-processor';
import crypto from 'crypto';

/* ---------------------------------------------------------------------------
 * POST Handler principal — Híbrido PRO limpio
 * ------------------------------------------------------------------------- */

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    /* ----------------------------------------------
     * 1) Log inicial del webhook
     * -------------------------------------------- */
    logger.info('Webhook MercadoPago recibido', {
      requestId,
      url: req.url,
      method: req.method,
    });

    // Capturar body raw sin modificaciones para HMAC
    // Usar arrayBuffer para preservar bytes exactos que envía MP
    const rawBuffer = await req.arrayBuffer();
    const rawBody = new TextDecoder('utf-8', { fatal: false }).decode(rawBuffer);
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');
    const { searchParams } = new URL(req.url);
    
    // Extraer dataId para ambos formatos: payment (data.id) y merchant_order (id)
    const dataIdFromUrl = searchParams.get('data.id') || searchParams.get('id');

    logger.info('Stage: Pre-validación de firma', {
      requestId,
      xSignature: xSignature?.slice(0, 25) + '...',
      xRequestId,
      dataIdFromUrl,
      bodyLength: rawBody.length,
    });

    /* ----------------------------------------------
     * 2) Validación HMAC oficial con fallback IP
     * -------------------------------------------- */
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET!;
    const clientIp = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';
    
    const signatureValidation = await verifyWebhookSignature(
      rawBody,
      xSignature,
      xRequestId,
      webhookSecret,
      dataIdFromUrl,
      clientIp
    );

    if (!signatureValidation.isValid) {
      logger.error('Firma HMAC inválida', {
        requestId,
        xSignature,
        error: signatureValidation.error,
      });

      return NextResponse.json(
        {
          success: false,
          error: signatureValidation.error,
          requestId,
          debug: Buffer.from(rawBody).toString('base64'),
        },
        { status: 401 }
      );
    }

    logger.info('Firma HMAC validada OK', {
      requestId,
      dataId: signatureValidation.dataId,
    });

    /* ----------------------------------------------
     * 3) Validar estructura del payload
     * -------------------------------------------- */
    const payloadValidation = validateWebhookPayload(rawBody);

    if (!payloadValidation.isValid) {
      logger.error('Payload inválido', {
        requestId,
        error: payloadValidation.error,
      });

      return NextResponse.json(
        { success: false, error: payloadValidation.error, requestId },
        { status: 400 }
      );
    }

    const { action, dataId } = payloadValidation;

    logger.info('Payload válido', {
      requestId,
      action,
      dataId,
    });

    /* ----------------------------------------------
     * 4) Procesar eventos de pago DIRECTAMENTE (sin doble salto)
     * -------------------------------------------- */
    const isPayment =
      action &&
      (action === 'payment' ||
        action.startsWith('payment.') ||
        action === 'payment.updated' ||
        action === 'payment.created');

    if (isPayment && dataId) {
      // IDEMPOTENCIA: Verificar si ya está siendo procesado
      const idempotencyCheck = await checkPaymentIdempotency(dataId);
      
      if (!idempotencyCheck.canProcess) {
        logger.info('[Webhook] Pago duplicado ignorado', {
          requestId,
          paymentId: dataId,
          reason: idempotencyCheck.reason,
          existingStatus: idempotencyCheck.existingStatus,
        });

        // Responder 200 OK para que MP no reintente
        return NextResponse.json({
          success: true,
          requestId,
          message: 'Pago ya procesado anteriormente',
          duplicate: true,
        });
      }

      // RESPUESTA INMEDIATA: Retornar 200 OK antes de procesar
      // Esto evita que MP envíe retries
      const responsePromise = NextResponse.json({
        success: true,
        requestId,
        message: 'Pago recibido y procesando',
      });

      // PROCESAMIENTO ASYNC: Procesar en background sin bloquear respuesta
      processPaymentWebhook(dataId, requestId)
        .then((result: { success: boolean; status?: string; error?: string; alreadyProcessed?: boolean }) => {
          if (result.success) {
            logger.info('[Webhook] Pago procesado exitosamente', {
              requestId,
              paymentId: dataId,
              status: result.status,
            });
          } else {
            logger.error('[Webhook] Error procesando pago', {
              requestId,
              paymentId: dataId,
              error: result.error,
            });
            
            // Guardar para retry manual si falla
            saveDeadLetterWebhook({
              paymentId: dataId,
              requestId,
              rawBody,
              headers: Object.fromEntries(req.headers.entries()),
              errorMessage: result.error || 'Error desconocido',
              clientIp,
            }).catch((err: Error) => {
              logger.error('[Webhook] Error guardando dead letter', {
                error: err.message,
              });
            });
          }
        })
        .catch((error: Error) => {
          logger.error('[Webhook] Error crítico en procesamiento async', {
            requestId,
            paymentId: dataId,
            error: error.message,
          });
        });

      return responsePromise;
    }

    if (action === 'merchant_order') {
      return NextResponse.json({
        success: true,
        requestId,
        message: 'Merchant order recibido (no procesado)',
      });
    }

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Evento desconocido ignorado',
    });
  } catch (error) {
    logger.error('Error interno procesando webhook', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    // IMPORTANTE: Siempre retornar 200 para evitar retries de MP
    // Los errores se manejan internamente
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      requestId,
    });
  }
}
