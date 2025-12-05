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
const MP_SECRET = (process.env.MERCADO_PAGO_WEBHOOK_SECRET || '').trim();

// Log de inicio para verificar configuración del secret (solo una vez al arrancar)
console.log('🚀 [HMAC STARTUP] Configuración inicial:');
console.log('🔍 MERCADO_PAGO_WEBHOOK_SECRET existe:', !!MP_SECRET);
if (MP_SECRET) {
  console.log('🔍 MERCADO_PAGO_WEBHOOK_SECRET length:', MP_SECRET.length);
  console.log('🔍 MERCADO_PAGO_WEBHOOK_SECRET starts with:', MP_SECRET.substring(0, 10) + '...');
} else {
  console.error('❌ [HMAC STARTUP] MERCADO_PAGO_WEBHOOK_SECRET NO CONFIGURADO - Los webhooks fallarán!');
}
const ALLOWED_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutos

/* --------------------------------------------------
 * Hash helper
 * -------------------------------------------------- */
function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/* --------------------------------------------------
 * Validación de HMAC Mercado Pago con múltiples intentos
 * -------------------------------------------------- */
export function verifyMercadoPagoWebhook(
  request: Request,
  rawBody: string
): MercadoPagoHmacValidationResult {
  // TEMPORAL: Verificar configuración del secret solo una vez
  if (!MP_SECRET) {
    console.error('❌ [HMAC CONFIG] MP_WEBHOOK_SECRET no está configurado!');
    return { ok: false, reason: 'MP_WEBHOOK_SECRET not configured' };
  }

  // Limpiar path de query params - MP firma solo el path sin query
  const cleanPath = request.url.split('?')[0];

  // Extraer headers para logging y validación
  const headers = Object.fromEntries(request.headers.entries());
  
  // Logging detallado para diagnóstico
  logger.info(' [HMAC DEBUG] Iniciando validación', {
    bodyLength: rawBody.length,
    bodyStart: rawBody.substring(0, 100),
    originalPath: request.url,
    cleanPath,
    headers: {
      'x-signature-version': headers['x-signature-version'],
      'x-signature-timestamp': headers['x-signature-timestamp'],
      'x-request-id': headers['x-request-id'],
      'x-signature': headers['x-signature']?.substring(0, 20) + '...'
    }
  });

  // Estrategia: intentar validación con diferentes cuerpos
  const bodiesToTry = [rawBody];
  
  // Detectar posible doble stringificación
  if (rawBody.startsWith('"') && rawBody.endsWith('"') && rawBody.includes('\\"')) {
    try {
      const parsedBody = JSON.parse(rawBody);
      if (typeof parsedBody === 'string') {
        bodiesToTry.push(parsedBody);
        logger.info(' [HMAC DEBUG] Detectada posible doble stringificación, intentando con body parseado');
      }
    } catch (e) {
      logger.warn(' [HMAC DEBUG] Falló parseo de doble stringificación', { error: e instanceof Error ? e.message : 'Unknown' });
    }
  }
  
  // Soporte para body con whitespace adicional (MP a veces firma con/sin salto de línea)
  if (rawBody.trim() !== rawBody) {
    bodiesToTry.push(rawBody.trim());
    logger.info(' [HMAC DEBUG] Detectado whitespace adicional, intentando con body trimmed');
  }

  // Intentar validación con cada cuerpo
  for (let i = 0; i < bodiesToTry.length; i++) {
    const bodyToTry = bodiesToTry[i];
    const attemptResult = validateHmacWithBody(headers, bodyToTry, cleanPath, i === 0 ? 'raw' : 'parsed');
    
    if (attemptResult.ok) {
      logger.info(' [HMAC DEBUG] Validación exitosa', {
        attempt: i === 0 ? 'raw' : i === 1 && rawBody.trim() !== rawBody ? 'trimmed' : 'parsed',
        dataId: attemptResult.dataId
      });
      return attemptResult;
    }
  }

  // Si todos los intentos fallaron, retornar el primer error
  return validateHmacWithBody(headers, rawBody, cleanPath, 'raw-final');
}

/* --------------------------------------------------
 * Validación HMAC con un cuerpo específico
 * -------------------------------------------------- */
function validateHmacWithBody(
  headers: Record<string, string | undefined>,
  body: string,
  cleanPath: string,
  attemptType: string
): MercadoPagoHmacValidationResult {
  try {
    let version = headers['x-signature-version'];     // “1”, “v1”, “2”, “3”
    let ts = headers['x-signature-timestamp'];        // timestamp numérico
    let requestId = headers['x-request-id'];            // UUID del webhook (puede faltar)
    let receivedSignature = headers['x-signature'] || '';   // firma enviada
    
    // FALLBACK: Extraer version y ts del header x-signature si faltan los separados
    if ((!version || !ts) && receivedSignature) {
      const signatureParts = receivedSignature.split(',');
      for (const part of signatureParts) {
        if (part.startsWith('ts=') && !ts) {
          ts = part.substring(3);
        } else if (part.startsWith('v=') && !version) {
          version = part.substring(2);
        } else if (part.startsWith('v1=') && !version) {
          version = 'v1';
        }
      }
      
      if (ts && !version) {
        version = 'v1'; // Default si encontramos ts pero no version
      }
    }
    
    // Normalizar firma: remover prefijo sha256= si existe y convertir a minúsculas
    receivedSignature = receivedSignature.replace(/^sha256=/i, '').toLowerCase();

    // TEMPORAL: Logging completo para debug de webhook simulado
    console.log('🔍 [HMAC DEBUG TEMPORAL] Headers recibidos:', {
      version,
      ts,
      requestId,
      receivedSignature: headers['x-signature'],
      normalizedSignature: receivedSignature,
      cleanPath,
      bodyLength: body.length,
      bodyStart: body.substring(0, 200),
      secretLength: MP_SECRET.length,
      secretStart: MP_SECRET.substring(0, 10) + '...',
      secretEmpty: !MP_SECRET
    });
    
    if (!version || !ts || !receivedSignature) {
      return { ok: false, reason: 'Missing signature headers' };
    }
    
    if (receivedSignature === '') {
      return { ok: false, reason: 'Empty signature after normalization' };
    }

    // Validar timestamp ANTES de cualquier cosa
    const now = Date.now();
    const timestampNum = Number(ts);
    if (isNaN(timestampNum)) {
      return {
        ok: false,
        reason: 'Invalid timestamp format'
      };
    }
    const diff = Math.abs(now - timestampNum);
    if (diff > ALLOWED_TOLERANCE_MS) {
      return {
        ok: false,
        reason: `Timestamp out of tolerance (${diff}ms)`
      };
    }

    // PROBLEMA REAL #2: Fallback para x-request-id faltante
    if (!requestId) {
      logger.warn(' [HMAC] x-request-id faltante, intentando extraer de query/body', {
        attemptType,
        url: cleanPath
      });
      
      // Extraer de query params (ej: /api/webhooks/mercadopago?id=123456)
      const urlMatch = cleanPath.match(/[?&]id=([^&]+)/);
      if (urlMatch) {
        requestId = urlMatch[1];
        logger.info(' [HMAC] x-request-id extraído de query', { requestId });
      } else {
        // Intentar extraer del body si es JSON
        try {
          const parsed = JSON.parse(body);
          const extractedId = parsed?.data?.id || parsed?.id || parsed?.payment_id;
          
          // Validar formato del ID extraído (UUID o numérico)
          if (!extractedId || extractedId === 'unknown' || typeof extractedId !== 'string') {
            return {
              ok: false,
              reason: 'Cannot extract valid x-request-id for HMAC validation - webhook unverifiable'
            };
          }
          
          // Verificar que sea UUID o ID numérico válido
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          const numericIdRegex = /^\d+$/;
          
          if (!uuidRegex.test(extractedId) && !numericIdRegex.test(extractedId)) {
            return {
              ok: false,
              reason: `Invalid x-request-id format extracted: ${extractedId}`
            };
          }
          
          requestId = extractedId;
          logger.info(' [HMAC] x-request-id extraído del body', { requestId });
        } catch {
          // CRÍTICO: Si no podemos extraer x-request-id, no podemos validar HMAC
          // porque MP firmó con el ID real que no conocemos
          return {
            ok: false,
            reason: 'Cannot extract x-request-id for HMAC validation - webhook unverifiable'
          };
        }
      }
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
      const bodyHash = sha256Hex(body);

      const stringToSign = `v1:${ts}:${requestId}:${cleanPath}:${bodyHash}`;
      
      // Debug: loggear stringToSign truncado
      logger.debug('[HMAC DEBUG] stringToSign', {
        attemptType,
        stringToSign: stringToSign.slice(0, 250) + (stringToSign.length > 250 ? '...' : '')
      });
      
      expectedSignature = crypto
        .createHmac('sha256', MP_SECRET)
        .update(stringToSign)
        .digest('hex');

      // TEMPORAL: Logging completo para debug de webhook simulado
      console.log('🔍 [HMAC DEBUG TEMPORAL] v1 Validation:', {
        attemptType,
        stringToSign,
        receivedSignature,
        expectedSignature,
        bodyHash,
        requestId,
        cleanPath,
        ts,
        signaturesMatch: receivedSignature === expectedSignature
      });

      const isValid = timingSafeEqualSafe(receivedSignature, expectedSignature);

      if (!isValid) {
        logger.warn('[HMAC v1] Firma inválida', {
          attemptType,
          stringToSign,
          receivedSignature,
          expectedSignature,
          bodyHash,
          requestId,
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
      const bodyHash = sha256Hex(body);

      const legacyString = `ts=${ts},v=${version},hash=${bodyHash}`;
      
      // Debug: loggear legacyString truncado
      logger.debug('[HMAC DEBUG] legacyString', {
        attemptType,
        legacyString: legacyString.slice(0, 250) + (legacyString.length > 250 ? '...' : '')
      });
      
      expectedSignature = crypto
        .createHmac('sha256', MP_SECRET)
        .update(legacyString)
        .digest('hex');

      // TEMPORAL: Logging completo para debug de webhook simulado
      console.log('🔍 [HMAC DEBUG TEMPORAL] legacy Validation:', {
        attemptType,
        legacyString,
        receivedSignature,
        expectedSignature,
        bodyHash,
        requestId,
        ts,
        signaturesMatch: receivedSignature === expectedSignature
      });

      const isValid = timingSafeEqualSafe(receivedSignature, expectedSignature);

      if (!isValid) {
        logger.warn('[HMAC legacy] Firma inválida', {
          attemptType,
          legacyString,
          receivedSignature,
          expectedSignature,
          bodyHash,
          requestId,
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
