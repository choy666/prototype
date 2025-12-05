// lib/mercado-pago/hmacVerifier.ts
// Validación de webhooks de Mercado Pago con múltiples capas de seguridad
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
  reason?: string;
  dataId?: string;
}

/* --------------------------------------------------
 * Configuración
 * -------------------------------------------------- */
const MP_SECRET = process.env.MP_WEBHOOK_SECRET || '';
const ALLOWED_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutos

/* --------------------------------------------------
 * Función principal
 * -------------------------------------------------- */
export function verifyMercadoPagoWebhook(
  headers: Record<string, string | undefined>,
  rawBody: string,
  requestPath: string
): MercadoPagoHmacValidationResult {
  try {
    const version = headers['x-signature-version'];
    const ts = headers['x-signature-timestamp'];
    const requestId = headers['x-request-id'];
    const receivedSignature = headers['x-signature'];

    if (!version || !ts || !requestId || !receivedSignature) {
      return {
        ok: false,
        reason: 'Missing signature headers',
      };
    }

    // Validar timestamp
    const now = Date.now();
    const diff = Math.abs(now - Number(ts));
    if (diff > ALLOWED_TOLERANCE_MS) {
      return {
        ok: false,
        reason: 'Timestamp out of tolerance',
      };
    }

    // Construcción del string_to_sign oficial
    const stringToSign = `ts:${ts};v:${version};path:${requestPath};id:${requestId};body:${rawBody}`;

    const computedSignature = crypto
      .createHmac('sha256', MP_SECRET)
      .update(stringToSign)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(computedSignature)
    );

    if (!isValid) {
      logger.warn('Firma inválida MP', {
        receivedSignature,
        computedSignature,
        stringToSign,
      });

      return {
        ok: false,
        reason: 'Invalid signature',
      };
    }

    return {
      ok: true,
      dataId: requestId,
    };
  } catch (err: unknown) {
    logger.error('Error verificando HMAC de MercadoPago', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return {
      ok: false,
      reason: errorMessage,
    };
  }
}
