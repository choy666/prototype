// lib/mercado-pago/hmacVerifier.ts

import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

/* ---------------------------------------------------------------------------
 * Tipos
 * ------------------------------------------------------------------------- */

export interface WebhookValidationResult {
  isValid: boolean;
  dataId?: string;
  error?: string;
  validationMethod?: 'hmac' | 'api' | 'simulator' | 'test';
}

export interface MercadoPagoHmacValidationResult {
  ok: boolean;
  dataId?: string;
  validationMethod?: 'hmac' | 'api' | 'simulator' | 'test';
}

/* ---------------------------------------------------------------------------
 * Helper: Lectura segura de headers
 * ------------------------------------------------------------------------- */

function getHeader(headers: Headers, name: string): string | null {
  try {
    return headers.get(name);
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * Validación via API de MercadoPago (fallback)
 * ------------------------------------------------------------------------- */

async function validateViaApi(
  dataId: string,
  accessToken: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    logger.info('[API VALIDATION] Intentando validación via API', { dataId });

    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${dataId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      const payment = await response.json();
      logger.info('[API VALIDATION] Pago verificado exitosamente', {
        paymentId: payment.id,
        status: payment.status,
        externalReference: payment.external_reference,
      });
      return { ok: true };
    }

    if (response.status === 404) {
      logger.warn('[API VALIDATION] Pago no encontrado', { dataId });
      return { ok: false, error: 'Pago no existe en MercadoPago' };
    }

    const errorText = await response.text();
    logger.error('[API VALIDATION] Error al consultar API', {
      status: response.status,
      error: errorText,
    });
    return { ok: false, error: `Error API: ${response.status}` };
  } catch (err) {
    logger.error('[API VALIDATION] Excepción', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/* ---------------------------------------------------------------------------
 * Validación HMAC SHA256 v1 Oficial MP
 * ------------------------------------------------------------------------- */

async function tryHmacValidation(
  rawBody: string,
  headers: Headers,
  webhookSecret: string,
  dataIdFromUrl: string | null
): Promise<{ ok: boolean; dataId?: string; error?: string }> {
  const normalizedSecret = webhookSecret.replace(/^["']|["']$/g, '').trim();

  // DEBUG AMBIENTAL: Comparar secrets y configuración
  logger.info('[ENV DEBUG] Validación HMAC', {
    environment: process.env.NODE_ENV,
    webhookSecretLength: webhookSecret.length,
    normalizedSecretLength: normalizedSecret.length,
    webhookSecretHash: crypto.createHash('sha256').update(webhookSecret).digest('hex').slice(0, 16),
    normalizedSecretHash: crypto.createHash('sha256').update(normalizedSecret).digest('hex').slice(0, 16),
    hasQuotes: webhookSecret !== normalizedSecret,
    hasLeadingTrailingSpaces: webhookSecret.length !== webhookSecret.trim().length,
    vercelEnv: process.env.VERCEL_ENV,
    isProduction: process.env.NODE_ENV === 'production'
  });

  const xSignature = getHeader(headers, 'x-signature');
  const xRequestId = getHeader(headers, 'x-request-id');

  // DEBUG HEADERS: Verificar si llegan completos
  logger.info('[HEADERS DEBUG]', {
    xSignaturePresent: !!xSignature,
    xRequestIdPresent: !!xRequestId,
    xSignatureLength: xSignature?.length,
    xRequestIdLength: xRequestId?.length,
    xSignaturePreview: xSignature?.slice(0, 50),
    allHeaders: Object.fromEntries(headers.entries())
  });

  if (!xSignature) return { ok: false, error: 'Header x-signature requerido' };
  if (!xRequestId) return { ok: false, error: 'Header x-request-id requerido' };

  // Parsear x-signature: ts=...,v1=...
  const parts = xSignature.split(',');
  let ts: string | undefined;
  let signature: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 'ts') ts = value;
    else if (key === 'v1') signature = value;
  }

  // Extraer data.id - PRIORIDAD: URL > body
  let dataId: string | undefined = dataIdFromUrl || undefined;

  if (!dataId) {
    try {
      const parsed = JSON.parse(rawBody);
      dataId =
        parsed?.data?.id ??
        parsed?.id ??
        (parsed?.resource ? String(parsed.resource).match(/(\d+)$/)?.[1] : undefined);
    } catch {
      /* ignore */
    }
  }

  // DEBUG CRÍTICO: Verificar componentes del stringToSign
  const stringToSign = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  
  // DEBUG BODY: Detectar transformaciones de proxy/reverse proxy
  const contentType = headers.get('content-type');
  const contentLength = headers.get('content-length');
  const actualBodyLength = rawBody.length;
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  
  // Detectar encoding y caracteres problemáticos
  const hasBom = rawBody.charCodeAt(0) === 0xFEFF;
  const hasTrailingWhitespace = rawBody !== rawBody.trim();
  const bodySample = rawBody.slice(0, 100) + (rawBody.length > 100 ? '...' : '');
  
  logger.info('[STRING_TO_SIGN DEBUG]', {
    dataId,
    dataIdSource: dataIdFromUrl ? 'URL' : 'body',
    xRequestId,
    ts,
    tsAsNumber: Number(ts),
    tsFormat: Number(ts) < 10000000000 ? 'seconds' : 'milliseconds',
    stringToSign,
    stringToSignLength: stringToSign.length,
    // Body analysis
    contentType,
    contentLength,
    actualBodyLength,
    contentLengthMatch: contentLength ? String(contentLength) === String(actualBodyLength) : 'unknown',
    bodyHash: bodyHash.slice(0, 16),
    hasBom,
    hasTrailingWhitespace,
    bodySample: bodySample.replace(/\n/g, '\\n').replace(/\r/g, '\\r'),
    // Environment detection
    userAgent: headers.get('user-agent'),
    xForwardedFor: headers.get('x-forwarded-for'),
    xForwardedProto: headers.get('x-forwarded-proto'),
    xRealIp: headers.get('x-real-ip'),
    via: headers.get('via'),
    cfRay: headers.get('cf-ray'), // Cloudflare
    xVercelId: headers.get('x-vercel-id') // Vercel
  });

  if (!dataId) return { ok: false, error: 'No se pudo encontrar data.id' };
  if (!ts) return { ok: false, error: 'No se pudo extraer ts del header' };
  if (!signature) return { ok: false, error: 'No se pudo extraer v1 del header' };

  const hmac = crypto.createHmac('sha256', normalizedSecret);
  hmac.update(stringToSign);
  const expected = hmac.digest('hex');

  let match = false;
  try {
    const recv = Buffer.from(signature, 'hex');
    const exp = Buffer.from(expected, 'hex');

    if (recv.length === exp.length) {
      match = crypto.timingSafeEqual(recv, exp);
    }
  } catch {
    /* ignore */
  }

  // DEBUG COMPARACIÓN: Mostrar diferencias exactas
  logger.info('[HMAC COMPARISON DEBUG]', {
    expectedLength: expected.length,
    receivedLength: signature?.length,
    expectedFirst16: expected.slice(0, 16),
    receivedFirst16: signature?.slice(0, 16),
    expectedLast16: expected.slice(-16),
    receivedLast16: signature?.slice(-16),
    match,
    lengthsMatch: expected.length === signature?.length,
    first8Match: expected.slice(0, 8) === signature?.slice(0, 8),
    last8Match: expected.slice(-8) === signature?.slice(-8)
  });

  if (!match) return { ok: false, dataId, error: 'Firma HMAC no coincide' };

  // Validar timestamp
  const maxAgeSeconds = parseInt(process.env.MP_WEBHOOK_MAX_AGE_SECONDS || '900', 10);
  const currentTs = Date.now();
  const receivedTsNum = Number(ts);
  const receivedMs = receivedTsNum < 10000000000 ? receivedTsNum * 1000 : receivedTsNum;
  const diff = Math.abs(currentTs - receivedMs);

  if (diff > maxAgeSeconds * 1000) {
    return { ok: false, dataId, error: `Timestamp muy antiguo (${Math.round(diff / 1000)}s)` };
  }

  return { ok: true, dataId };
}

/* ---------------------------------------------------------------------------
 * Validación principal con fallback a API
 * ------------------------------------------------------------------------- */

export async function validateMercadoPagoHmac(
  rawBody: string,
  headers: Headers,
  webhookSecret: string,
  dataIdFromUrl: string | null
): Promise<MercadoPagoHmacValidationResult> {
  logger.info('validateMercadoPagoHmac INIT', {
    bodyLength: rawBody.length,
    hasSecret: !!webhookSecret,
    dataIdFromUrl,
  });

  // Caso especial: simulador MP
  try {
    const parsed = JSON.parse(rawBody);
    const simulatedId = parsed?.data?.id ?? parsed?.id;

    if (simulatedId === 123456 || simulatedId === '123456') {
      logger.warn('[SIMULATOR MODE] ID=123456 → permitido');
      return { ok: true, dataId: String(simulatedId), validationMethod: 'simulator' };
    }

    if (!getHeader(headers, 'x-signature') && parsed?.action === 'test.notification') {
      logger.info('test.notification sin firma → permitido');
      return { ok: true, validationMethod: 'test' };
    }
  } catch {
    /* ignore */
  }

  if (!webhookSecret) throw new Error('Webhook secret no configurado');

  // 1. Intentar HMAC primero
  const hmacResult = await tryHmacValidation(rawBody, headers, webhookSecret, dataIdFromUrl);

  if (hmacResult.ok) {
    logger.info('[VALIDATION SUCCESS] HMAC válido', { dataId: hmacResult.dataId });
    return { ok: true, dataId: hmacResult.dataId, validationMethod: 'hmac' };
  }

  // 2. HMAC falló → intentar validación via API
  logger.warn('[HMAC FAILED] Intentando fallback via API', { error: hmacResult.error });

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(`HMAC falló (${hmacResult.error}) y no hay ACCESS_TOKEN para fallback`);
  }

  // Extraer dataId para consulta API
  let dataId = hmacResult.dataId || dataIdFromUrl;
  if (!dataId) {
    try {
      const parsed = JSON.parse(rawBody);
      dataId = parsed?.data?.id ?? parsed?.id;
    } catch {
      /* ignore */
    }
  }

  if (!dataId) {
    throw new Error(`HMAC falló (${hmacResult.error}) y no se pudo extraer dataId para API`);
  }

  const apiResult = await validateViaApi(String(dataId), accessToken);

  if (apiResult.ok) {
    logger.info('[VALIDATION SUCCESS] Validado via API (fallback)', { dataId });
    return { ok: true, dataId: String(dataId), validationMethod: 'api' };
  }

  throw new Error(`Validación falló - HMAC: ${hmacResult.error}, API: ${apiResult.error}`);
}

/* ---------------------------------------------------------------------------
 * Wrappers existentes (sin cambios en firma)
 * ------------------------------------------------------------------------- */

export async function verifyHmacSHA256(
  xSignature: string | undefined,
  rawBody: string,
  webhookSecret: string,
  xRequestId?: string | null,
  dataIdFromUrl?: string | null
): Promise<WebhookValidationResult> {
  try {
    const headers = new Headers();
    if (xSignature) headers.set('x-signature', xSignature);
    if (xRequestId) headers.set('x-request-id', xRequestId);

    const result = await validateMercadoPagoHmac(rawBody, headers, webhookSecret, dataIdFromUrl ?? null);
    return { isValid: result.ok, dataId: result.dataId, validationMethod: result.validationMethod };
  } catch (err) {
    return { isValid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function verifyWebhookSignature(
  rawBody: string,
  xSignature: string | null,
  xRequestId: string | null,
  webhookSecret: string,
  dataIdFromUrl: string | null
): Promise<WebhookValidationResult> {
  try {
    if (process.env.NODE_ENV === 'development' && !webhookSecret) {
      logger.warn('DEV MODE → sin validación');
      try {
        const p = JSON.parse(rawBody);
        return { isValid: true, dataId: p?.data?.id ?? undefined, validationMethod: 'test' };
      } catch {
        return { isValid: true, validationMethod: 'test' };
      }
    }

    const headers = new Headers();
    if (xSignature) headers.set('x-signature', xSignature);
    if (xRequestId) headers.set('x-request-id', xRequestId);

    const result = await validateMercadoPagoHmac(rawBody, headers, webhookSecret, dataIdFromUrl);
    return { isValid: result.ok, dataId: result.dataId, validationMethod: result.validationMethod };
  } catch (err) {
    return { isValid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function validateWebhookPayload(rawBody: string) {
  try {
    const p = JSON.parse(rawBody);
    if (p?.action === 'test.notification') return { isValid: true, action: p.action };

    const dataId = p?.data?.id ?? p?.id ?? (p?.resource ? String(p.resource).match(/(\d+)$/)?.[1] : undefined);
    const action = p.action || p.topic;

    if (!action || !dataId) return { isValid: false, error: 'Estructura inválida' };
    return { isValid: true, action, dataId };
  } catch {
    return { isValid: false, error: 'JSON inválido' };
  }
}
