// lib/mercado-pago/hmacVerifier.ts
// Validación correcta y robusta de webhooks de Mercado Pago (v1 + fallback legacy)

import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

/* --------------------------------------------------
 * Tipos
 * -------------------------------------------------- */
export interface MercadoPagoHmacValidationResult {
  ok: boolean;
  reason?: string;
  dataId?: string;
}

/* --------------------------------------------------
 * Configuración
 * -------------------------------------------------- */
const MP_SECRET = process.env.MP_WEBHOOK_SECRET || '';
const ALLOWED_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutos

/* --------------------------------------------------
 * Hash helper
 * -------------------------------------------------- */
function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/* --------------------------------------------------
 * Validación de HMAC Mercado Pago
 * -------------------------------------------------- */
export function verifyMercadoPagoWebhook(
  headers: Record<string, string | undefined>,
  rawBody: string,
  requestPath: string
): MercadoPagoHmacValidationResult {
  try {
    const version = headers['x-signature-version'];     // “1”, “v1”, “2”, “3”
    const ts = headers['x-signature-timestamp'];        // timestamp numérico
    const requestId = headers['x-request-id'];          // UUID del webhook
    const receivedSignature = headers['x-signature'];   // firma enviada

    if (!version || !ts || !requestId || !receivedSignature) {
      return { ok: false, reason: 'Missing signature headers' };
    }

    /* ----------------------------------------------
     * 1) Validar tolerancia de tiempo
     * -------------------------------------------- */
    const now = Date.now();
    const diff = Math.abs(now - Number(ts));
    if (diff > ALLOWED_TOLERANCE_MS) {
      return {
        ok: false,
        reason: `Timestamp out of tolerance (${diff}ms)`
      };
    }

    /* ----------------------------------------------
     * 2) Determinar variante de firma
     * -------------------------------------------- */
    const normalized = version.toLowerCase().trim();

    let expectedSignature = '';

    /* --------------------------------------------------
     * VARIANTE A — v1 oficial (recomendada por MP)
     *
     * string_to_sign = v1:{ts}:{requestId}:{path}:{sha256(body)}
     * HMAC-SHA256 con tu webhook secret
     * -------------------------------------------------- */
    if (normalized === '1' || normalized === 'v1') {
      const bodyHash = sha256Hex(rawBody);

      const stringToSign = `v1:${ts}:${requestId}:${requestPath}:${bodyHash}`;

      expectedSignature = crypto
        .createHmac('sha256', MP_SECRET)
        .update(stringToSign)
        .digest('hex');

      const isValid = timingSafeEqualSafe(receivedSignature, expectedSignature);

      if (!isValid) {
        logger.warn('[HMAC v1] Firma inválida', {
          stringToSign,
          receivedSignature,
          expectedSignature,
        });

        return { ok: false, reason: 'Invalid v1 signature' };
      }

      return { ok: true, dataId: requestId };
    }

    /* --------------------------------------------------
     * VARIANTE B — v2/v3 legacy (todavía usada por MP en algunos flows)
     *
     * formato:
     *    ts={ts},v={version},hash={sha256(rawBody)}
     *
     * HMAC-SHA256 del string raw anterior
     * -------------------------------------------------- */
    if (normalized === '2' || normalized === '3') {
      const bodyHash = sha256Hex(rawBody);

      const legacyString = `ts=${ts},v=${version},hash=${bodyHash}`;

      expectedSignature = crypto
        .createHmac('sha256', MP_SECRET)
        .update(legacyString)
        .digest('hex');

      const isValid = timingSafeEqualSafe(receivedSignature, expectedSignature);

      if (!isValid) {
        logger.warn('[HMAC legacy] Firma inválida', {
          legacyString,
          receivedSignature,
          expectedSignature,
        });

        return { ok: false, reason: 'Invalid legacy v2/v3 signature' };
      }

      return { ok: true, dataId: requestId };
    }

    /* --------------------------------------------------
     * Si MP envía una versión desconocida
     * -------------------------------------------------- */
    return {
      ok: false,
      reason: `Unsupported signature version: ${version}`,
    };
  } catch (err: unknown) {
    logger.error('Error verificando HMAC MercadoPago', err);
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/* --------------------------------------------------
 * timingSafeEqual protegido contra errores
 * -------------------------------------------------- */
function timingSafeEqualSafe(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
