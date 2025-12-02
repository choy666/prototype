import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

/* --------------------------------------------------
 * Tipos para los resultados
 * -------------------------------------------------- */
export interface WebhookValidationResult {
  isValid: boolean;
  dataId?: string;
  error?: string;
}

export interface MercadoPagoHmacValidationResult {
  ok: boolean;
  dataId?: string;
}

/* --------------------------------------------------
 * Helper seguro para leer headers
 * -------------------------------------------------- */
function getHeader(headers: Headers, name: string): string | null {
  try {
    return headers.get(name);
  } catch {
    return null;
  }
}

/* --------------------------------------------------
 * Validación oficial HMAC SHA256 v1 de Mercado Pago
 *
 * Requiere:
 *   ts      → timestamp enviado
 *   v1      → firma HMAC
 *   x-request-id → obligatorio
 *
 * string_to_sign EXACTO:
 *   id:{id};request-id:{x-request-id};ts:{ts}
 * -------------------------------------------------- */
export function validateMercadoPagoHmac(
  rawBody: string,
  headers: Headers,
  webhookSecret: string
): MercadoPagoHmacValidationResult {
  logger.info('Iniciando validateMercadoPagoHmac', {
    rawBodyLength: rawBody.length,
    webhookSecretSet: !!webhookSecret,
  });

  if (!webhookSecret) {
    logger.error('Webhook secret no configurado para validación HMAC');
    throw new Error('Webhook secret no configurado');
  }

  /* ------------------------------
   * Leer headers requeridos
   * ------------------------------ */
  const xSignature = getHeader(headers, 'x-signature');
  const xRequestId = getHeader(headers, 'x-request-id');

  logger.info('Headers clave', {
    xSignaturePresent: !!xSignature,
    xRequestIdPresent: !!xRequestId,
  });

  /* ------------------------------
   * Permitir test.notification sin firma
   * ------------------------------ */
  if (!xSignature) {
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed?.action === 'test.notification') {
        logger.info('Webhook test.notification detectado sin firma → OK');
        return { ok: true };
      }
    } catch {}
    throw new Error('Header x-signature requerido');
  }

  if (!xRequestId) {
    throw new Error('Header x-request-id requerido para validación HMAC');
  }

  /* ------------------------------
   * Parsear x-signature: ts=...,v1=...
   * ------------------------------ */
  let ts: string | undefined;
  let signature: string | undefined;

  try {
    const parts = xSignature.split(',');
    for (const rawPart of parts) {
      const [key, value] = rawPart.trim().split('=');
      if (key === 'ts') ts = value;
      if (key === 'v1') signature = value;
    }
  } catch {
    throw new Error('Formato de x-signature inválido');
  }

  if (!ts || !signature) {
    throw new Error('Formato inválido: faltan ts o v1');
  }

  /* ------------------------------
   * Parsear payload e identificar data.id
   * ------------------------------ */
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error('Payload JSON inválido');
  }

  const p = parsed as {
    action?: string;
    data?: { id?: unknown };
    id?: unknown;
    resource?: unknown;
  };

  // test.notification firmada
  if (p.action === 'test.notification') {
    return { ok: true };
  }

  const dataId: string | undefined =
    (p.data?.id != null ? String(p.data.id) : undefined) ??
    (p.id != null ? String(p.id) : undefined) ??
    (() => {
      // merchant_order o payment con resource URL
      if (p.resource != null) {
        const m = String(p.resource).match(/(\d+)$/);
        return m?.[1];
      }
      return undefined;
    })();

  if (!dataId) {
    throw new Error('Falta data.id en payload para construir string_to_sign');
  }

  /* ------------------------------
   * Construir string_to_sign EXACTO
   * ------------------------------ */
  const stringToSign = `id:${dataId};request-id:${xRequestId};ts:${ts}`;

  /* ------------------------------
   * Generar HMAC SHA256 esperado
   * ------------------------------ */
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(stringToSign);
  const expected = hmac.digest('hex');

  const received = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  if (!crypto.timingSafeEqual(received, expectedBuf)) {
    throw new Error('Firma inválida');
  }

  return { ok: true, dataId };
}

/* --------------------------------------------------
 * Wrapper simplificado: verifyHmacSHA256
 * Cascade te va a pedir llamarlo desde el route handler
 * -------------------------------------------------- */
export function verifyHmacSHA256(
  xSignature: string | undefined,
  rawBody: string,
  webhookSecret: string,
  xRequestId?: string | null
): WebhookValidationResult {
  logger.info('verifyHmacSHA256 INIT', {
    xSignatureLength: xSignature?.length,
    hasRequestId: !!xRequestId,
  });

  try {
    const headers = new Headers();
    if (xSignature) headers.set('x-signature', xSignature);
    if (xRequestId) headers.set('x-request-id', xRequestId);

    const result = validateMercadoPagoHmac(rawBody, headers, webhookSecret);

    return { isValid: result.ok, dataId: result.dataId };
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* --------------------------------------------------
 * verifyWebhookSignature
 * (Modo compatibilidad y fallback)
 * -------------------------------------------------- */
export function verifyWebhookSignature(
  rawBody: string,
  xSignature: string | null,
  xRequestId: string | null,
  webhookSecret: string
): WebhookValidationResult {
  try {
    // En desarrollo sin secret → permitir
    if (process.env.NODE_ENV === 'development' && !webhookSecret) {
      logger.warn('DEV MODE: Saltando validación HMAC');
      try {
        const parsed = JSON.parse(rawBody);
        return {
          isValid: true,
          dataId: parsed?.data?.id ? String(parsed.data.id) : undefined,
        };
      } catch {
        return { isValid: true };
      }
    }

    const headers = new Headers();
    if (xSignature) headers.set('x-signature', xSignature);
    if (xRequestId) headers.set('x-request-id', xRequestId);

    const result = validateMercadoPagoHmac(rawBody, headers, webhookSecret);

    return { isValid: result.ok, dataId: result.dataId };
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* --------------------------------------------------
 * Validación de estructura del payload
 * (Después de validar firma)
 * -------------------------------------------------- */
export function validateWebhookPayload(rawBody: string): {
  isValid: boolean;
  action?: string;
  dataId?: string;
  error?: string;
} {
  try {
    const p = JSON.parse(rawBody);

    // test.notification
    if (p?.action === 'test.notification') {
      return { isValid: true, action: p.action };
    }

    const dataId: string | undefined =
      p?.data?.id ??
      p?.id ??
      (() => {
        if (p?.resource) {
          const m = String(p.resource).match(/(\d+)$/);
          return m?.[1];
        }
        return undefined;
      })();

    const actionOrTopic = p.action || p.topic;

    if (!actionOrTopic || !dataId) {
      return {
        isValid: false,
        error: 'Estructura inválida: faltan action/topic o data.id',
      };
    }

    return {
      isValid: true,
      action: actionOrTopic,
      dataId,
    };
  } catch {
    return {
      isValid: false,
      error: 'JSON inválido',
    };
  }
}
