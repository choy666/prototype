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
     * 2) RESPUESTA INMEDIATA 200 OK para detener reintentos
     * -------------------------------------------- */
    // Retornar 200 inmediatamente para que MP no reintente
    // Procesaremos todo en background incluyendo validación HMAC
    const immediateResponse = NextResponse.json({
      success: true,
      requestId,
      message: 'Webhook recibido, procesando en background',
      processing: 'async',
    });

    /* ----------------------------------------------
     * 3) PROCESAMIENTO ASYNC COMPLETO (incluyendo validación)
     * -------------------------------------------- */
    // Procesar en background sin bloquear la respuesta
    processWebhookAsync(requestId, rawBody, xSignature, xRequestId, dataIdFromUrl, req.headers)
      .catch((error) => {
        logger.error('[Webhook] Error crítico en procesamiento async', {
          requestId,
          error: error.message,
        });
      });

    // Retornar respuesta inmediata para detener reintentos
    return immediateResponse;

  } catch (error) {
    logger.error('Error interno procesando webhook', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    // IMPORTANTE: Siempre retornar 200 para evitar retries de MP
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      requestId,
    });
  }
}

/* ----------------------------------------------
 * Función async para procesamiento completo
 * -------------------------------------------- */
async function processWebhookAsync(
  requestId: string,
  rawBody: string,
  xSignature: string | null,
  xRequestId: string | null,
  dataIdFromUrl: string | null,
  headers: Headers
) {
  try {
    /* ----------------------------------------------
     * 1) Validación HMAC oficial con fallback IP
     * -------------------------------------------- */
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET!;
    const clientIp = headers.get('x-forwarded-for') || 
                    headers.get('x-real-ip') || 
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
      logger.error('Firma HMAC inválida (procesamiento async)', {
        requestId,
        xSignature,
        error: signatureValidation.error,
      });

      // Guardar en dead letter para análisis manual
      await saveDeadLetterWebhook({
        paymentId: dataIdFromUrl || 'unknown',
        requestId,
        rawBody,
        headers: Object.fromEntries(headers.entries()),
        errorMessage: signatureValidation.error || 'HMAC inválido',
        clientIp,
      });

      return; // No procesar más si HMAC es inválido
    }

    logger.info('Firma HMAC validada OK (async)', {
      requestId,
      dataId: signatureValidation.dataId,
    });

    /* ----------------------------------------------
     * 2) Validar estructura del payload
     * -------------------------------------------- */
    const payloadValidation = validateWebhookPayload(rawBody);

    if (!payloadValidation.isValid) {
      logger.error('Payload inválido (async)', {
        requestId,
        error: payloadValidation.error,
      });
      return;
    }

    const { action, dataId } = payloadValidation;

    logger.info('Payload válido (async)', {
      requestId,
      action,
      dataId,
    });

    /* ----------------------------------------------
     * 3) Procesar eventos de pago
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
        logger.info('[Webhook] Pago duplicado ignorado (async)', {
          requestId,
          paymentId: dataId,
          reason: idempotencyCheck.reason,
          existingStatus: idempotencyCheck.existingStatus,
        });
        return;
      }

      // Procesar pago
      const result = await processPaymentWebhook(dataId, requestId);
      
      if (result.success) {
        logger.info('[Webhook] Pago procesado exitosamente (async)', {
          requestId,
          paymentId: dataId,
          status: result.status,
        });
      } else {
        logger.error('[Webhook] Error procesando pago (async)', {
          requestId,
          paymentId: dataId,
          error: result.error,
        });
        
        // Guardar para retry manual si falla
        await saveDeadLetterWebhook({
          paymentId: dataId,
          requestId,
          rawBody,
          headers: Object.fromEntries(headers.entries()),
          errorMessage: result.error || 'Error desconocido',
          clientIp,
        });
      }
    }

    if (action === 'merchant_order') {
      logger.info('[Webhook] Merchant order recibido (async)', {
        requestId,
      });
    }

  } catch (error) {
    logger.error('[Webhook] Error en procesamiento async', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
