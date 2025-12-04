/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/webhooks/mercadopago/route.ts

import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { verifyWebhookSignature, validateWebhookPayload } from '@/lib/mercado-pago/hmacVerifier';
import crypto from 'crypto';

/* ---------------------------------------------------------------------------
 * Helpers: Persistencia (serverless-safe)
 * ------------------------------------------------------------------------- */

async function saveFailedWebhookForRetry(data: {
  paymentId: string;
  requestId: string;
  retryCount: number;
  error: string;
  timestamp: string;
}) {
  try {
    logger.warn('Webhook guardado para retry externo', {
      ...data,
      action: 'RETRY_LATER',
    });

    // TODO → Persistencia real (Redis / DB / Queue)
  } catch (storageError) {
    logger.error('Error guardando webhook para retry', {
      ...data,
      error: storageError instanceof Error ? storageError.message : String(storageError),
    });
  }
}

async function saveDeadLetterWebhook(data: {
  paymentId: string;
  requestId: string;
  error: string;
  timestamp: string;
}) {
  try {
    logger.error('Webhook enviado a DEAD LETTER', {
      ...data,
      action: 'DEAD_LETTER',
    });

    // TODO → Dead-letter real (tabla / alerta / dashboard)
  } catch (storageError) {
    logger.error('Error guardando webhook en dead letter', {
      ...data,
      error: storageError instanceof Error ? storageError.message : String(storageError),
    });
  }
}

/* ---------------------------------------------------------------------------
 * Validación del entorno crítico
 * ------------------------------------------------------------------------- */

function validateEnvironmentVariables() {
  const required = ['MERCADO_PAGO_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET'];

  const missing = required.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    logger.error('Variables de entorno faltantes', { missing });
    throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}`);
  }

  logger.info('Variables de entorno validadas correctamente');
}

validateEnvironmentVariables();

/* ---------------------------------------------------------------------------
 * Forward interno → /api/mercadopago/payments/notify
 * ------------------------------------------------------------------------- */

async function forwardToPaymentsNotify(
  rawBody: string,
  requestId: string,
  paymentId?: string | null
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

      await saveFailedWebhookForRetry({
        paymentId: paymentId ?? 'unknown',
        requestId,
        retryCount: 1,
        error: `HTTP ${response.status}: ${text}`,
        timestamp: new Date().toISOString(),
      });

      await saveDeadLetterWebhook({
        paymentId: paymentId ?? 'unknown',
        requestId,
        error: `HTTP ${response.status}: ${text}`,
        timestamp: new Date().toISOString(),
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

    await saveFailedWebhookForRetry({
      paymentId: paymentId ?? 'unknown',
      requestId,
      retryCount: 1,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });

    await saveDeadLetterWebhook({
      paymentId: paymentId ?? 'unknown',
      requestId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
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
    const dataIdFromUrl = searchParams.get('data.id');

    logger.info('Stage: Pre-validación de firma', {
      requestId,
      xSignature: xSignature?.slice(0, 25) + '...',
      xRequestId,
      dataIdFromUrl,
      bodyLength: rawBody.length,
    });

    /* ----------------------------------------------
     * 2) Validación HMAC oficial
     * -------------------------------------------- */
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET!;
    const signatureValidation = await verifyWebhookSignature(
      rawBody,
      xSignature,
      xRequestId,
      webhookSecret,
      dataIdFromUrl
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
      forwardToPaymentsNotify(rawBody, requestId, dataId).catch((error) => {
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
