/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/webhooks/mercadopago/route.ts
// Webhook optimizado de Mercado Pago

import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { verifyMercadoPagoWebhook } from '@/lib/mercado-pago/hmacVerifier';
import { saveDeadLetterWebhook } from '@/lib/actions/webhook-failures';
import { processPaymentWebhook, checkPaymentIdempotency } from '@/lib/actions/payment-processor';
import crypto from 'crypto';

/* ---------------------------------------------------------------------------
 * POST Handler — Webhook Mercado Pago sincronizado con hmacVerifier.ts
 * ------------------------------------------------------------------------- */
export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    // Extraer datos básicos
    const rawBuffer = await req.arrayBuffer();
    const rawBody = Buffer.from(rawBuffer).toString('utf8');
    const headers = req.headers;
    const { searchParams } = new URL(req.url);
    const dataIdFromUrl = searchParams.get('data.id') || searchParams.get('id') || null;

    logger.info('Webhook received', {
      requestId,
      signature: headers.get('x-signature')?.slice(0, 20) + '...',
      bodyLength: rawBody.length,
    });

    // Responder inmediatamente y procesar en background
    const immediateResponse = NextResponse.json({
      success: true,
      requestId,
      message: 'Webhook received, processing asynchronously',
    });

    processWebhookAsync({
      requestId,
      rawBody,
      headers,
      dataIdFromUrl,
      request: req,
    }).catch((error) => {
      logger.error('Async webhook processing failed', {
        requestId,
        error: error.message,
      });
    });

    return immediateResponse;
  } catch (error) {
    logger.error('Webhook handler error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ success: false, requestId });
  }
}

/* ---------------------------------------------------------------------------
 * PROCESAMIENTO ASYNC COMPLETO
 * ------------------------------------------------------------------------- */
async function handlePaymentWebhook(
  dataId: string, 
  requestId: string, 
  rawBody: string, 
  headers: Headers
) {
  try {
    // Verificar idempotencia para evitar procesamiento duplicado
    const idem = await checkPaymentIdempotency(dataId);

    if (!idem.canProcess) {
      logger.info('Duplicate payment ignored', {
        requestId,
        paymentId: dataId,
        reason: idem.reason,
      });
      return;
    }

    // Procesar pago
    const result = await processPaymentWebhook(dataId, requestId);

    if (!result.success) {
      logger.error('Payment processing failed', {
        requestId,
        paymentId: dataId,
        error: result.error,
      });

      // Guardar en dead letter si falla el procesamiento
      await saveDeadLetterWebhook({
        paymentId: dataId,
        requestId,
        rawBody,
        headers: Object.fromEntries(headers.entries()),
        errorMessage: result.error || 'Payment processing failed',
        clientIp: headers.get('x-forwarded-for') || 'unknown',
      });
      return;
    }

    logger.info('Payment processed successfully', {
      requestId,
      paymentId: dataId,
      status: result.status,
    });
  } catch (error) {
    logger.error('Payment webhook handler error', {
      requestId,
      paymentId: dataId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function processWebhookAsync({ requestId, rawBody, headers, dataIdFromUrl, request }: {
  requestId: string;
  rawBody: string;
  headers: Headers;
  dataIdFromUrl: string | null;
  request: Request;
}) {
  try {
    // Validar HMAC
    const hmacValidation = verifyMercadoPagoWebhook(request, rawBody);

    if (!hmacValidation.ok) {
      logger.warn('HMAC validation failed - saving to dead letter', {
        requestId,
        reason: hmacValidation.reason,
      });

      await saveDeadLetterWebhook({
        paymentId: dataIdFromUrl || 'unknown',
        requestId,
        rawBody,
        headers: Object.fromEntries(headers.entries()),
        errorMessage: hmacValidation.reason || 'HMAC validation failed',
        clientIp: headers.get('x-forwarded-for') || 'unknown',
      });

      return;
    }

    logger.info('HMAC validated', {
      requestId,
      dataId: hmacValidation.dataId,
    });

    // Parsear payload
    const payload = JSON.parse(rawBody);
    const action = payload?.action || null;
    const dataId = payload?.data?.id || dataIdFromUrl;

    if (!action || !dataId) {
      logger.error('Invalid payload - missing required fields', {
        requestId,
        action,
        dataId,
      });
      return;
    }

    // Procesar según tipo de acción
    const isPayment = action.startsWith('payment') || 
                     action === 'payment.created' || 
                     action === 'payment.updated';

    if (isPayment) {
      await handlePaymentWebhook(dataId, requestId, rawBody, headers);
    } else if (action === 'merchant_order') {
      logger.info('Merchant order webhook received', { requestId });
      // TODO: Implementar procesamiento de merchant orders si es necesario
    }
  } catch (error) {
    logger.error('Webhook processing error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
