/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/webhooks/mercadopago/route.ts
import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { verifyWebhookSignature, validateWebhookPayload } from '@/lib/mercado-pago/hmacVerifier';
import crypto from 'crypto';

// Funciones de persistencia para failed webhooks (serverless-safe)
async function saveFailedWebhookForRetry(data: {
  paymentId: string;
  requestId: string;
  retryCount: number;
  error: string;
  timestamp: string;
}) {
  try {
    // En producción, esto podría guardar en Redis, DB, o cola de mensajes
    // Por ahora, loggear para retry manual o procesamiento externo
    logger.warn('Webhook guardado para retry externo', {
      ...data,
      action: 'RETRY_LATER'
    });
    
    // TODO: Implementar persistencia real según infraestructura
    // - Redis con TTL para retry automático
    // - Tabla en BD para procesamiento batch
    // - SQS/SNS para cola de reintentos
    
  } catch (storageError) {
    logger.error('Error guardando webhook para retry', {
      paymentId: data.paymentId,
      requestId: data.requestId,
      error: storageError instanceof Error ? storageError.message : String(storageError)
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
    // Guardar en dead letter queue para intervención manual
    logger.error('Webhook enviado a dead letter queue', {
      ...data,
      action: 'DEAD_LETTER'
    });
    
    // TODO: Implementar dead letter queue real
    // - Tabla webhook_dead_letters
    // - Alerta a admin
    // - Dashboard de monitoreo
    
  } catch (storageError) {
    logger.error('Error guardando webhook en dead letter', {
      paymentId: data.paymentId,
      requestId: data.requestId,
      error: storageError instanceof Error ? storageError.message : String(storageError)
    });
  }
}

// Validación de variables de entorno críticas
function validateEnvironmentVariables() {
  const required = [
    'MERCADO_PAGO_ACCESS_TOKEN',
    'MERCADO_PAGO_WEBHOOK_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    const error = `Variables de entorno faltantes: ${missing.join(', ')}`;
    logger.error('Validación de entorno fallida', { missing });
    throw new Error(error);
  }
  
  logger.info('Variables de entorno validadas correctamente');
}

// Validar entorno al iniciar el módulo
validateEnvironmentVariables();
 
async function forwardToPaymentsNotify(rawBody: string, requestId: string, paymentId?: string | null) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const notifyUrl = `${baseUrl}/api/mercadopago/payments/notify`;

    logger.info('Reenviando webhook de pago a /api/mercadopago/payments/notify', {
      requestId,
      notifyUrl,
      paymentId,
    });

    const response = await fetch(notifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: rawBody,
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('Error reenviando webhook a payments/notify', {
        requestId,
        status: response.status,
        body: text,
        paymentId,
      });

      await saveFailedWebhookForRetry({
        paymentId: paymentId || 'unknown',
        requestId,
        retryCount: 1,
        error: `HTTP ${response.status}: ${text}`,
        timestamp: new Date().toISOString(),
      });

      await saveDeadLetterWebhook({
        paymentId: paymentId || 'unknown',
        requestId,
        error: `HTTP ${response.status}: ${text}`,
        timestamp: new Date().toISOString(),
      });
    } else {
      logger.info('Webhook reenviado exitosamente a payments/notify', {
        requestId,
        paymentId,
        status: response.status,
      });
    }
  } catch (error) {
    logger.error('Error crítico reenviando webhook a payments/notify', {
      requestId,
      paymentId,
      error: error instanceof Error ? error.message : String(error),
    });

    await saveFailedWebhookForRetry({
      paymentId: paymentId || 'unknown',
      requestId,
      retryCount: 1,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });

    await saveDeadLetterWebhook({
      paymentId: paymentId || 'unknown',
      requestId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  
  try {
    logger.info('Webhook MercadoPago: Inicio de procesamiento', {
      requestId,
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    });

    // 1. Leer body como RAW text (CRÍTICO: antes de cualquier parseo)
    const rawBody = await req.text();
    
    // 2. Extraer headers de validación ANTES de cualquier procesamiento
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');
    
    // 3. LOG COMPLETO SIN CENSURA para diagnóstico (TEMPORAL)
    logger.info('🔍 [DEBUG] Webhook completo sin censura', {
      requestId,
      xSignature: xSignature || 'MISSING',
      xRequestId: xRequestId || 'MISSING',
      rawBody: rawBody,
      rawBodyLength: rawBody.length,
      webhookSecretLength: process.env.MERCADO_PAGO_WEBHOOK_SECRET?.length || 0,
      webhookSecretFirst4: process.env.MERCADO_PAGO_WEBHOOK_SECRET?.substring(0, 4) || 'MISSING',
      webhookSecretLast4: process.env.MERCADO_PAGO_WEBHOOK_SECRET?.substring(process.env.MERCADO_PAGO_WEBHOOK_SECRET.length - 4) || 'MISSING'
    });

    // 3.1 GUARDAR DATOS EN RESPUESTA BASE64 para diagnóstico (TEMPORAL)
    const debugData = {
      requestId,
      timestamp: new Date().toISOString(),
      xSignature,
      xRequestId,
      rawBody,
      headers: Object.fromEntries(req.headers.entries()),
      webhookSecretLength: process.env.MERCADO_PAGO_WEBHOOK_SECRET?.length || 0,
      webhookSecretFirst4: process.env.MERCADO_PAGO_WEBHOOK_SECRET?.substring(0, 4) || 'MISSING',
      webhookSecretLast4: process.env.MERCADO_PAGO_WEBHOOK_SECRET?.substring(process.env.MERCADO_PAGO_WEBHOOK_SECRET.length - 4) || 'MISSING'
    };
    
    const debugBase64 = Buffer.from(JSON.stringify(debugData, null, 2)).toString('base64');
    
    // Dividir base64 en chunks para evitar truncamiento de logs
    const chunkSize = 200;
    const totalChunks = Math.ceil(debugBase64.length / chunkSize);
    
    logger.info(`🔍 [DEBUG BASE64] Datos codificados (${totalChunks} partes, ${debugBase64.length} chars total)`);
    
    for (let i = 0; i < totalChunks; i++) {
      const chunk = debugBase64.substring(i * chunkSize, (i + 1) * chunkSize);
      logger.info(`🔍 [DEBUG BASE64] PART${i + 1}/${totalChunks}: ${chunk}`);
    }
    
    logger.info(`🔍 [DEBUG BASE64] Instrucciones: Copiar todas las partes en orden y decodificar`);

    // 4. Validar firma HMAC con RAW body (antes de parsear)
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    const signatureValidation = verifyWebhookSignature(
      rawBody,
      xSignature,
      xRequestId,
      webhookSecret || ''
    );

    if (!signatureValidation.isValid) {
      logger.error('Webhook MercadoPago: Firma inválida', {
        requestId,
        xSignature,
        xRequestId,
        bodyLength: rawBody.length,
        error: signatureValidation.error
      });
      
      return NextResponse.json({ 
        success: false, 
        error: signatureValidation.error || 'Firma inválida',
        requestId,
        debug: debugBase64 // Incluir datos completos en base64
      }, { status: 401 });
    }

    logger.info('Webhook MercadoPago: Firma validada exitosamente', {
      requestId,
      dataId: signatureValidation.dataId
    });

    // 4. Parsear el JSON (después de validar firma) solo para validar que sea JSON válido
    try {
      JSON.parse(rawBody);
    } catch (parseError) {
      logger.error('Webhook MercadoPago: Error parseando payload', {
        requestId,
        error: parseError instanceof Error ? parseError.message : String(parseError)
      });
      
      return NextResponse.json({ 
        success: false, 
        error: 'Payload JSON inválido',
        requestId
      }, { status: 400 });
    }

    // 5. Validar estructura del payload
    const payloadValidation = validateWebhookPayload(rawBody);
    if (!payloadValidation.isValid) {
      logger.error('Webhook MercadoPago: Estructura inválida', {
        requestId,
        error: payloadValidation.error,
        rawBody: rawBody.substring(0, 200) + '...'
      });
      
      return NextResponse.json({ 
        success: false, 
        error: payloadValidation.error || 'Estructura inválida',
        requestId
      }, { status: 400 });
    }

    // Extraer datos del payload validado
    const eventType = payloadValidation.action;
    const eventId = payloadValidation.dataId;

    logger.info('Webhook MercadoPago recibido', {
      requestId,
      eventType,
      eventId,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    });

    // 6. Procesar evento según tipo
    const isPaymentEvent =
      !!eventType && (
        eventType === 'payment' ||
        eventType === 'payment.updated' ||
        eventType === 'payment.created' ||
        eventType.startsWith('payment.')
      );

    if (isPaymentEvent && eventId) {
      logger.info(`Procesando evento de pago ${eventType} - reenviando a payments/notify`, {
        requestId,
        eventId,
      });

      forwardToPaymentsNotify(rawBody, requestId, eventId.toString())
        .catch(error => {
          logger.error('Error en procesamiento asíncrono de pago (forwardToPaymentsNotify)', {
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return NextResponse.json({
        success: true,
        requestId,
        message: 'Pago recibido y encolado para procesamiento',
      });

    } else if (eventType === 'merchant_order' && eventId) {
      logger.info('Evento merchant_order recibido; no se procesa en este webhook', {
        requestId,
        eventId,
      });

      return NextResponse.json({
        success: true,
        requestId,
        message: 'Merchant order recibido (sin procesamiento)',
      });
      
    } else {
      logger.info('Evento de webhook no procesado', { 
        requestId, 
        eventType 
      });

      return NextResponse.json({ 
        success: true, 
        requestId,
        message: 'Evento recibido pero no procesado'
      });
    }

  } catch (error) {
    logger.error('Error procesando webhook MercadoPago', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor',
      requestId
    }, { status: 500 });
  }
}
