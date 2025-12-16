/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/webhooks/mercadopago/route.ts
// Webhook optimizado de Mercado Pago

import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { verifyMercadoPagoWebhook } from '@/lib/mercado-pago/hmacVerifier';
import { saveDeadLetterWebhook } from '@/lib/actions/webhook-failures';
import { processPaymentWebhook, checkPaymentIdempotency } from '@/lib/actions/payment-processor';
import { processMerchantOrderWebhook } from '@/lib/actions/merchant-order-processor';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { randomUUID } from 'crypto';

/* ---------------------------------------------------------------------------
 * POST Handler — Webhook Mercado Pago sincronizado con hmacVerifier.ts
 * ------------------------------------------------------------------------- */
export async function POST(req: Request) {
  const requestId = randomUUID();

  try {
    // Extraer datos básicos
    const rawBuffer = await req.arrayBuffer();
    const rawBody = Buffer.from(rawBuffer).toString('utf8');
    const headers = req.headers;
    const { searchParams } = new URL(req.url);
    const dataIdFromUrl = searchParams.get('data.id') || searchParams.get('id') || null;
    const topicFromUrl = searchParams.get('topic') || searchParams.get('type') || null;

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
      topicFromUrl,
      request: req,
    }).catch((error) => {
      logger.error('Async webhook processing failed', {
        requestId,
        error: error.message,
      });
    });

    return immediateResponse;
  } catch (error) {
    console.error('WEBHOOK ERROR:', error); // Debug temporal
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
  headers: Headers,
  requiresManualVerification: boolean = false,
  hmacFailureReason?: string
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

    // Procesar pago con indicador de verificación manual y contexto de auditoría
    const hmacAuditContext = requiresManualVerification && hmacFailureReason ? {
      validationResult: 'fallback_used',
      failureReason: hmacFailureReason,
      fallbackUsed: true,
      webhookRequestId: requestId,
    } : undefined;

    const result = await processPaymentWebhook(dataId, requestId, requiresManualVerification, hmacAuditContext);

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
      requiresManualVerification,
    });
  } catch (error) {
    logger.error('Payment webhook handler error', {
      requestId,
      paymentId: dataId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/* ---------------------------------------------------------------------------
 * VERIFICACIÓN VÍA API DIRECTA (fallback cuando HMAC falla)
 * ------------------------------------------------------------------------- */
async function verifyPaymentViaAPI(paymentId: string, requestId: string): Promise<{
  isValid: boolean;
  paymentData?: any;
  error?: string;
}> {
  try {
    logger.info('[HMAC-FALLBACK] Verificando pago vía API MP', {
      paymentId,
      requestId,
    });

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
      options: { timeout: 5000 },
    });

    const payment = new Payment(client);
    const paymentData = await payment.get({ id: paymentId });

    logger.info('[HMAC-FALLBACK] Pago verificado vía API', {
      paymentId,
      status: paymentData.status,
      requestId,
    });

    return {
      isValid: true,
      paymentData,
    };
  } catch (error) {
    logger.error('[HMAC-FALLBACK] Error verificando pago vía API', {
      paymentId,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      isValid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function processWebhookAsync({ requestId, rawBody, headers, dataIdFromUrl, topicFromUrl, request }: {
  requestId: string;
  rawBody: string;
  headers: Headers;
  dataIdFromUrl: string | null;
  topicFromUrl: string | null;
  request: Request;
}) {
  try {
    // Parsear payload temprano para poder decidir el fallback (payment vs merchant_order)
    let payload: any = null;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = null;
    }

    const action = payload?.action || payload?.type || payload?.topic || topicFromUrl || null;
    let dataId = payload?.data?.id || dataIdFromUrl;

    const isMerchantOrder = action === 'merchant_order' || action?.startsWith('merchant_order');
    const isPaymentFromAction = action?.startsWith('payment') || action === 'payment.created' || action === 'payment.updated';

    // Validar HMAC
    const hmacValidation = verifyMercadoPagoWebhook(request, rawBody);
    let requiresManualVerification = false;
    let paymentDataFromAPI = null;

    if (!hmacValidation.ok) {
      logger.warn('HMAC validation failed - intentando verificación vía API', {
        requestId,
        reason: hmacValidation.reason,
      });

      // Para merchant_order NO hacer fallback de pago: el ID no es payment_id.
      // Igual procesamos merchant_order consultando MP con access token.
      if (isMerchantOrder) {
        // Continuar sin verificación adicional
      } else {

        // Si es payment, intentar verificación vía API
        let paymentId = dataId;
        if (!paymentId && !isPaymentFromAction) {
          paymentId = dataIdFromUrl;
        }

        if (paymentId) {
          const apiVerification = await verifyPaymentViaAPI(String(paymentId), requestId);
          
          if (apiVerification.isValid) {
            logger.info('[HMAC-FALLBACK] Verificación vía API exitosa - procesando pago', {
              requestId,
              paymentId,
              status: apiVerification.paymentData.status,
            });
            
            requiresManualVerification = true;
            paymentDataFromAPI = apiVerification.paymentData;
          } else {
            logger.error('[HMAC-FALLBACK] Verificación vía API falló - guardando en dead letter', {
              requestId,
              paymentId,
              error: apiVerification.error,
            });

            await saveDeadLetterWebhook({
              paymentId: String(paymentId) || 'unknown',
              requestId,
              rawBody,
              headers: Object.fromEntries(headers.entries()),
              errorMessage: `HMAC failed: ${hmacValidation.reason}. API verification failed: ${apiVerification.error}`,
              clientIp: headers.get('x-forwarded-for') || 'unknown',
            });

            return;
          }
        } else {
          logger.error('[HMAC-FALLBACK] Sin payment_id - guardando en dead letter', {
            requestId,
          });

          await saveDeadLetterWebhook({
            paymentId: 'unknown',
            requestId,
            rawBody,
            headers: Object.fromEntries(headers.entries()),
            errorMessage: `HMAC failed: ${hmacValidation.reason}. No payment_id found`,
            clientIp: headers.get('x-forwarded-for') || 'unknown',
          });

          return;
        }
      }
    } else {
      logger.info('HMAC validated', {
        requestId,
        dataId: hmacValidation.dataId,
      });
    }

    // Si tenemos datos de API pero no del payload, usar los de API
    if (paymentDataFromAPI && !dataId) {
      dataId = paymentDataFromAPI.id?.toString();
    }

    // 🔥 MEJORADO: Para HMAC fallback, permitir dataId sin action
    if (requiresManualVerification && paymentDataFromAPI && dataId) {
      logger.info('[HMAC-FALLBACK] Procesando con datos de API (sin action requerido)', {
        requestId,
        paymentId: dataId,
        hasAction: !!action,
      });
    } else if (!action || !dataId) {
      logger.error('Invalid payload - missing required fields', {
        requestId,
        action,
        dataId,
        requiresManualVerification,
        hasApiData: !!paymentDataFromAPI,
      });
      return;
    }

    // Procesar según tipo de acción
    const isPayment = action?.startsWith('payment') || 
                     action === 'payment.created' || 
                     action === 'payment.updated' ||
                     (!action && requiresManualVerification && paymentDataFromAPI); // 🔥 HMAC fallback sin action

    if (isPayment) {
      await handlePaymentWebhook(dataId, requestId, rawBody, headers, requiresManualVerification, hmacValidation.reason);
    } else if (action === 'merchant_order' || action?.startsWith('merchant_order')) {
      logger.info('Merchant order webhook received', { requestId, merchantOrderId: dataId });

      if (!dataId) {
        logger.error('Merchant order payload inválido - falta data.id', { requestId });
        return;
      }

      const result = await processMerchantOrderWebhook(String(dataId), requestId);

      if (!result.success) {
        logger.error('Merchant order processing failed', {
          requestId,
          merchantOrderId: dataId,
          error: result.error,
        });
      } else {
        logger.info('Merchant order processed successfully', {
          requestId,
          merchantOrderId: dataId,
          orderId: result.orderId,
          shipmentId: result.shipmentId,
          shipmentPending: result.shipmentPending,
        });
      }
    } else {
      logger.warn('Acción no reconocida', { requestId, action, requiresManualVerification });
    }
  } catch (error) {
    logger.error('Webhook processing error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
