// lib/mercado-pago/hmacVerifier.ts
// Validación optimizada de webhooks de Mercado Pago

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
const MP_SECRET = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
const ALLOWED_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutos

// Validar configuración al inicio
if (!MP_SECRET) {
  logger.error('❌ MERCADO_PAGO_WEBHOOK_SECRET no configurado');
}


/* --------------------------------------------------
 * Validación principal optimizada
 * -------------------------------------------------- */
export function verifyMercadoPagoWebhook(
  request: Request,
  rawBody: string
): MercadoPagoHmacValidationResult {
  if (!MP_SECRET) {
    return { ok: false, reason: 'MP_WEBHOOK_SECRET not configured' };
  }

  const cleanPath = request.url.split('?')[0];
  const headers = Object.fromEntries(request.headers.entries());
  
  // Intentar validación con cuerpo limpio (sin whitespace)
  const cleanBody = rawBody.trim();
  const result = validateHmacV1(headers, cleanBody, cleanPath);
  
  // Si falla, intentar con body original por si MP firmó con whitespace
  if (!result.ok && cleanBody !== rawBody) {
    return validateHmacV1(headers, rawBody, cleanPath);
  }
  
  return result;
}

/* --------------------------------------------------
 * Validación HMAC v1 optimizada
 * -------------------------------------------------- */
function validateHmacV1(
  headers: Record<string, string | undefined>,
  body: string,
  cleanPath: string
): MercadoPagoHmacValidationResult {
  try {
    const signature = headers['x-signature'] || '';
    const signatureParts = signature.split(',');
    
    // Extraer timestamp y version de la firma
    let ts = '';
    let requestId = headers['x-request-id'] || '';
    
    for (const part of signatureParts) {
      if (part.startsWith('ts=')) ts = part.substring(3);
      if (part.startsWith('v1=')) {
        // Extraer requestId del body si no viene en header
        if (!requestId) {
          try {
            const parsed = JSON.parse(body);
            requestId = parsed?.data?.id || parsed?.id || '';
          } catch {
            // Ignorar error, continuará con requestId vacío
          }
        }
      }
    }
    
    // Validaciones básicas
    if (!ts || !requestId) {
      return { ok: false, reason: 'Missing required signature data' };
    }
    
    // Validar timestamp
    const timestampNum = Number(ts);
    if (isNaN(timestampNum) || Math.abs(Date.now() - timestampNum) > ALLOWED_TOLERANCE_MS) {
      return { ok: false, reason: 'Invalid or expired timestamp' };
    }
    
    // Construir string a firmar: v1:{ts}:{requestId}:{path}:{sha256(body)}
    const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
    const stringToSign = `v1:${ts}:${requestId}:${cleanPath}:${bodyHash}`;
    
    // Calcular firma esperada
    const expectedSignature = crypto
      .createHmac('sha256', MP_SECRET!)
      .update(stringToSign)
      .digest('hex');
    
    // Extraer firma recibida (remover prefijos si existen)
    const receivedSignature = signature
      .replace(/^sha256=/i, '')
      .split(',')
      .find(part => part.startsWith('v1='))?.substring(3) || '';
    
    // Validar firma
    if (!timingSafeEqualSafe(receivedSignature, expectedSignature)) {
      logger.warn('HMAC validation failed', {
        requestId,
        ts,
        path: cleanPath,
        bodyLength: body.length,
        // 🔥 DEBUG: Mostrar componentes exactos para identificar el problema
        debug: {
          receivedSignature,
          expectedSignature,
          stringToSign,
          bodyHash,
          signatureHeader: signature,
          secretLength: MP_SECRET?.length || 0,
          secretPrefix: MP_SECRET?.substring(0, 8) + '...',
        }
      });
      return { ok: false, reason: 'Invalid signature' };
    }
    
    return { ok: true, dataId: requestId };
    
  } catch (err) {
    logger.error('HMAC validation error', err);
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Unknown error'
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
