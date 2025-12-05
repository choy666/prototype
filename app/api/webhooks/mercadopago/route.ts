/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/webhooks/mercadopago/route.ts
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
    logger.info('Webhook MercadoPago recibido', {
      requestId,
      url: req.url,
      method: req.method,
    });

    const rawBuffer = await req.arrayBuffer();
    const rawBody = Buffer.from(rawBuffer).toString('utf8');
    const headers = req.headers;
    const xSignature = headers.get('x-signature');
    const xRequestId = headers.get('x-request-id');

    const { searchParams } = new URL(req.url);
    const dataIdFromUrl = searchParams.get('data.id') || searchParams.get('id') || null;

    logger.info('Stage: Pre-validación de firma', {
      requestId,
      xSignature: xSignature?.slice(0, 25) + '...',
      xRequestId,
      dataIdFromUrl,
      bodyLength: rawBody.length,
      clientIp: headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown',
    });

    const immediateResponse = NextResponse.json({
      success: true,
      requestId,
      message: 'Webhook recibido, procesando en background',
      processing: 'async',
    });

    processWebhookAsync({
      requestId,
      rawBody,
      headers,
      dataIdFromUrl,
      request: req,
    }).catch((error) => {
      logger.error('[Webhook] Error crítico async', {
        requestId,
        error: error.message,
      });
    });

    return immediateResponse;
  } catch (error) {
    logger.error('Error interno procesando webhook', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ success: false, requestId });
  }
}

/* ---------------------------------------------------------------------------
 * PROCESAMIENTO ASYNC COMPLETO
 * ------------------------------------------------------------------------- */
async function processWebhookAsync({ requestId, rawBody, headers, dataIdFromUrl, request }: {
  requestId: string;
  rawBody: string;
  headers: Headers;
  dataIdFromUrl: string | null;
  request: Request;
}) {
  try {
    const hmacValidation = verifyMercadoPagoWebhook(
      request,
      rawBody
    );

    if (!hmacValidation.ok) {
      logger.error('HMAC inválido', {
        requestId,
        error: hmacValidation.reason,
      });

      await saveDeadLetterWebhook({
        paymentId: dataIdFromUrl || 'unknown',
        requestId,
        rawBody,
        headers: Object.fromEntries(headers.entries()),
        errorMessage: hmacValidation.reason || 'HMAC inválido',
        clientIp: headers.get('x-forwarded-for') || 'unknown',
      });

      return;
    }

    logger.info('Firma HMAC validada (async)', {
      requestId,
      dataId: hmacValidation.dataId,
    });

    const payload = JSON.parse(rawBody);

    const action = payload?.action || null;
    const dataId = payload?.data?.id || dataIdFromUrl;

    if (!action || !dataId) {
      logger.error('Payload inválido (faltan campos)', {
        requestId,
        action,
        dataId,
      });
      return;
    }

    const isPayment =
      action.startsWith('payment') ||
      action === 'payment.created' ||
      action === 'payment.updated';

    if (isPayment) {
      const idem = await checkPaymentIdempotency(dataId);

      if (!idem.canProcess) {
        logger.info('[Webhook] Pago duplicado ignorado', {
          requestId,
          paymentId: dataId,
          reason: idem.reason,
        });
        return;
      }

      const result = await processPaymentWebhook(dataId, requestId);

      if (!result.success) {
        logger.error('[Webhook] Error procesando pago', {
          requestId,
          paymentId: dataId,
          error: result.error,
        });

        await saveDeadLetterWebhook({
          paymentId: dataId,
          requestId,
          rawBody,
          headers: Object.fromEntries(headers.entries()),
          errorMessage: result.error || 'Error desconocido',
          clientIp: headers.get('x-forwarded-for') || 'unknown',
        });
        return;
      }

      logger.info('[Webhook] Pago procesado OK', {
        requestId,
        paymentId: dataId,
        status: result.status,
      });
    }

    if (action === 'merchant_order') {
      logger.info('[Webhook] Merchant order recibido', { requestId });
    }
  } catch (error) {
    logger.error('[Webhook] Error async', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
