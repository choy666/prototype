/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/webhooks/mercadopago/route.ts

import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { verifyWebhookSignature, validateWebhookPayload } from '@/lib/mercado-pago/hmacVerifier';
import { saveFailedWebhookForRetry, saveDeadLetterWebhook } from '@/lib/actions/webhook-failures';
import crypto from 'crypto';

/* ---------------------------------------------------------------------------
 * Forward interno → /api/mercadopago/payments/notify
 * ------------------------------------------------------------------------- */

async function forwardToPaymentsNotify(
  rawBody: string,
  requestId: string,
  paymentId?: string | null,
  headers?: Record<string, string>,
  clientIp?: string
) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const notifyUrl = `${baseUrl}/api/mercadopago/payments/notify`;

    logger.info('Reenviando webhook a payments/notify', {
      requestId,
      notifyUrl,
      paymentId,
    });

    const response = await fetch(notifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
    });

    if (!response.ok) {
      const text = await response.text();

      logger.error('Error reenviando webhook', {
        requestId,
        status: response.status,
        text,
        paymentId,
      });

      // Guardar en DB para retry posterior
      await saveFailedWebhookForRetry({
        paymentId: paymentId ?? 'unknown',
        requestId,
        rawBody,
        headers: headers || {},
        errorMessage: `HTTP ${response.status}: ${text}`,
        clientIp,
      });

    } else {
      logger.info('Webhook reenviado exitosamente', {
        requestId,
        paymentId,
        status: response.status,
      });
    }
  } catch (error) {
    logger.error('Error crítico forwarding webhook', {
      requestId,
      paymentId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Guardar como dead letter si falla completamente
    await saveDeadLetterWebhook({
      paymentId: paymentId ?? 'unknown',
      requestId,
      rawBody,
      headers: headers || {},
      errorMessage: error instanceof Error ? error.message : String(error),
      clientIp,
    });
  }
}

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

    const rawBody = await req.text();
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
     * 4) Procesar eventos
     * -------------------------------------------- */
    const isPayment =
      action &&
      (action === 'payment' ||
        action.startsWith('payment.') ||
        action === 'payment.updated' ||
        action === 'payment.created');

    if (isPayment && dataId) {
      forwardToPaymentsNotify(
        rawBody, 
        requestId, 
        dataId, 
        Object.fromEntries(req.headers.entries()),
        clientIp
      ).catch((error) => {
        logger.error('Error async forwarding', {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      return NextResponse.json({
        success: true,
        requestId,
        message: 'Pago recibido y encolado para procesamiento',
      });
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

    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', requestId },
      { status: 500 }
    );
  }
}
