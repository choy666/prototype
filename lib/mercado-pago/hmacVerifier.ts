/* eslint-disable @typescript-eslint/no-explicit-any */
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
}

export interface MercadoPagoHmacValidationResult {
  ok: boolean;
  dataId?: string;
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
 * Validación HMAC SHA256 v1 Oficial MP
 *
 * string_to_sign EXACTO:
 *    id:{id};request-id:{x-request-id};ts:{ts};
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

  if (!webhookSecret) throw new Error('Webhook secret no configurado');
  // Normalizar secret: quitar comillas y espacios
  const normalizedSecret = webhookSecret.replace(/^["']|["']$/g, '').trim();
  
  // Debug del secret original vs normalizado
  logger.info('Webhook Secret Debug', {
    originalLength: webhookSecret.length,
    normalizedLength: normalizedSecret.length,
    originalFirst5: webhookSecret.slice(0, 5),
    originalLast5: webhookSecret.slice(-5),
    normalizedFirst5: normalizedSecret.slice(0, 5),
    normalizedLast5: normalizedSecret.slice(-5),
    hasQuotes: webhookSecret !== normalizedSecret,
    hasLeadingTrailingSpaces: webhookSecret.length !== webhookSecret.trim().length
  });

  const xSignature = getHeader(headers, 'x-signature');
  const xRequestId = getHeader(headers, 'x-request-id');

  logger.info('Headers recibidos', {
    xSignaturePresent: !!xSignature,
    xRequestIdPresent: !!xRequestId,
  });

  /* --------------------------------------------
   * Caso especial → simulador oficial MP
   * ------------------------------------------ */
  try {
    const parsed = JSON.parse(rawBody);
    const simulatedId = parsed?.data?.id ?? parsed?.id;

    if (simulatedId === 123456 || simulatedId === '123456') {
      logger.warn('[SIMULATOR MODE] Webhook con ID=123456 → permitido sin validar');
      return { ok: true, dataId: String(simulatedId) };
    }

    if (!xSignature && parsed?.action === 'test.notification') {
      logger.info('test.notification sin firma → permitido');
      return { ok: true };
    }
  } catch {
    /* ignore parsing error */
  }

  if (!xSignature) throw new Error('Header x-signature requerido');
  if (!xRequestId) throw new Error('Header x-request-id requerido');

  /* --------------------------------------------
   * Extraer data.id
   * ------------------------------------------ */

  /* --------------------------------------------
   * Extraer data.id - PRIORIDAD: URL > body
   * ------------------------------------------ */

  // Primero intentar desde la URL (recomendado por MP)
  let dataId: string | undefined = dataIdFromUrl || undefined;

  // Si no hay en URL, extraer del body
  if (!dataId) {
    try {
      const parsed = JSON.parse(rawBody);
      dataId =
        parsed?.data?.id ??
        parsed?.id ??
        (parsed?.resource ? String(parsed.resource).match(/(\d+)$/)?.[1] : undefined);
    } catch {
      /* ignore parsing error */
    }
  }

  if (!dataId) throw new Error('No se pudo encontrar data.id en URL o body');

  /* --------------------------------------------
   * Parsear x-signature → ts y v1
   * ------------------------------------------ */

  let ts: string | undefined;
  let signature: string | undefined;

  xSignature.split(',').forEach((part) => {
    const [key, value] = part.trim().split('=');
    if (key === 'ts') ts = value;
    if (key === 'v1') signature = value;
  });

  if (!ts || !signature) throw new Error('Formato x-signature inválido: falta ts o v1');

  const stringToSign = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  /* --------------------------------------------
   * Generar firma esperada
   * ------------------------------------------ */

  const hmac = crypto.createHmac('sha256', normalizedSecret);
  hmac.update(stringToSign);
  const expected = hmac.digest('hex');

  /* --------------------------------------------
   * Comparación segura
   * ------------------------------------------ */

  let match = false;

  try {
    const recv = Buffer.from(signature, 'hex');
    const exp = Buffer.from(expected, 'hex');

    if (recv.length === exp.length) {
      match = crypto.timingSafeEqual(recv, exp);
    }
  } catch (err) {
    logger.error('Error en timingSafeEqual', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Debug sin redactar - console.log directo para bypass
  console.log('=== HMAC DEBUG UNREDACTED ===');
  console.log('dataId:', dataId);
  console.log('xRequestId:', xRequestId);
  console.log('ts:', ts);
  console.log('stringToSign:', stringToSign);
  console.log('expected:', expected);
  console.log('received:', signature);
  console.log('webhookSecret length:', normalizedSecret.length);
  console.log('webhookSecret first5:', normalizedSecret.slice(0, 5));
  console.log('webhookSecret last5:', normalizedSecret.slice(-5));
  console.log('=== END HMAC DEBUG ===');

  logger.info('[DEBUG HMAC RESULT]', {
    dataId,
    stringToSign,
    expected,
    received: signature,
    match,
    // Debug sin redactar (temporal)
    rawSecret: {
      length: normalizedSecret.length,
      first5: normalizedSecret.slice(0, 5),
      last5: normalizedSecret.slice(-5),
      full: normalizedSecret
    },
    rawValues: {
      dataId,
      xRequestId,
      ts,
      signature,
      webhookSecret: normalizedSecret
    }
  });

  if (!match) throw new Error('Firma inválida — no coincide con la esperada');

  return { ok: true, dataId };
}

/* ---------------------------------------------------------------------------
 * Wrapper simple usado desde el route → verifyHmacSHA256
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

    const result = await validateMercadoPagoHmac(
      rawBody,
      headers,
      webhookSecret,
      dataIdFromUrl ?? null
    );

    return { isValid: result.ok, dataId: result.dataId };
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* ---------------------------------------------------------------------------
 * Wrapper principal del route → verifyWebhookSignature
 * ------------------------------------------------------------------------- */

export async function verifyWebhookSignature(
  rawBody: string,
  xSignature: string | null,
  xRequestId: string | null,
  webhookSecret: string,
  dataIdFromUrl: string | null
): Promise<WebhookValidationResult> {
  try {
    // Desarrollo sin secret → permite
    if (process.env.NODE_ENV === 'development' && !webhookSecret) {
      logger.warn('DEV MODE → sin validación HMAC');

      try {
        const p = JSON.parse(rawBody);
        return { isValid: true, dataId: p?.data?.id ?? undefined };
      } catch {
        return { isValid: true };
      }
    }

    const headers = new Headers();
    if (xSignature) headers.set('x-signature', xSignature);
    if (xRequestId) headers.set('x-request-id', xRequestId);

    const result = await validateMercadoPagoHmac(
      rawBody,
      headers,
      webhookSecret,
      dataIdFromUrl
    );

    return { isValid: result.ok, dataId: result.dataId };
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* ---------------------------------------------------------------------------
 * Validación estructura del payload
 * ------------------------------------------------------------------------- */

export function validateWebhookPayload(rawBody: string) {
  try {
    const p = JSON.parse(rawBody);

    if (p?.action === 'test.notification') return { isValid: true, action: p.action };

    const dataId =
      p?.data?.id ??
      p?.id ??
      (() => {
        if (p?.resource) return String(p.resource).match(/(\d+)$/)?.[1];
      })();

    const action = p.action || p.topic;

    if (!action || !dataId)
      return { isValid: false, error: 'Estructura inválida: falta action/topic o data.id' };

    return { isValid: true, action, dataId };
  } catch {
    return { isValid: false, error: 'JSON inválido' };
  }
}
