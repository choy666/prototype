// lib/mercado-pago/hmacVerifier.ts
// Validación de webhooks de Mercado Pago con múltiples capas de seguridad

import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

export interface WebhookValidationResult {
  isValid: boolean;
  dataId?: string;
  error?: string;
  warning?: string;
}

interface MercadoPagoHmacValidationResult {
  ok: boolean;
  dataId?: string;
  error?: string;
}


// Type para Redis client global
interface RedisClient {
  exists(key: string): Promise<number>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  get(key: string): Promise<string | null>;
}

// Type para globalThis extendido
declare global {
  var _redisClient: RedisClient | undefined;
}

/**
 * Extrae timestamp Unix del x-request-id de Mercado Pago
 * Formato: timestamp-randomString
 */
function extractTimestampFromRequestId(requestId: string | null): number | null {
  if (!requestId) return null;
  
  const parts = requestId.split('-');
  if (parts.length === 0) return null;
  
  const timestampStr = parts[0];
  const timestamp = parseInt(timestampStr, 10);
  
  // Validar timestamp Unix válido (10 dígitos aprox)
  if (isNaN(timestamp) || timestamp < 1000000000 || timestamp > 9999999999) {
    return null;
  }
  
  return timestamp;
}

/**
 * Extrae dataId del payload JSON
 */
function extractDataIdFromPayload(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody);
    return parsed?.data?.id || parsed?.id || null;
  } catch {
    return null;
  }
}

/**
 * Validación HMAC oficial de Mercado Pago con múltiples formatos de template
 */
async function validateMercadoPagoHmac(
  rawBody: string,
  headers: Headers,
  webhookSecret: string,
  dataIdFromUrl: string | null
): Promise<MercadoPagoHmacValidationResult> {
  try {
    const xSignature = headers.get('x-signature');
    const xRequestId = headers.get('x-request-id');

    if (!xSignature) {
      return { ok: false, error: 'Missing x-signature header' };
    }

    // Extraer componentes del header
    const signatureParts = xSignature.split(',');
    let ts = null;
    let v1 = null;

    for (const part of signatureParts) {
      const [key, value] = part.trim().split('=');
      if (key === 'ts') ts = value;
      if (key === 'v1') v1 = value;
    }

    if (!ts || !v1) {
      return { ok: false, error: 'Invalid signature format' };
    }

    // Extraer dataId
    const dataId = dataIdFromUrl || extractDataIdFromPayload(rawBody);
    if (!dataId) {
      return { ok: false, error: 'No se pudo encontrar data.id' };
    }

    // PROBAR MÚLTIPLES FORMATOS DE TEMPLATE SEGÚN DOCUMENTACIÓN MP 2024
    const requestId = xRequestId || '';
    const templateVariants = [
      // Formato oficial documentación MP 2024 (más probable)
      `data.id=${dataId};ts=${ts};x-request-id=${requestId}`,
      // Formato sin x-request-id (casos reportados)
      `data.id=${dataId};ts=${ts}`,
      // Formato con id simple (legacy)
      `id=${dataId};ts=${ts};x-request-id=${requestId}`,
      `id=${dataId};ts=${ts}`,
      // Formatos con ampersands (menos común)
      `data.id=${dataId}&ts=${ts}&x-request-id=${requestId}`,
      `data.id=${dataId}&ts=${ts}`,
    ];

    let validSignature = null;
    let validTemplate = null;
    let expectedSignature = null;

    // Probar cada variante hasta encontrar coincidencia
    for (const template of templateVariants) {
      expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(template, 'utf8')
        .digest('hex');

      if (v1 === expectedSignature) {
        validSignature = v1;
        validTemplate = template;
        break;
      }
    }

    // Logging detallado para diagnóstico
    logger.info('[HMAC] Validación multi-formato', {
      dataId,
      xRequestId,
      ts,
      receivedSignature: v1,
      validTemplate: validTemplate || 'NONE',
      templatesTested: templateVariants.length,
      isValid: validSignature !== null,
      // Primeros 8 chars de cada firma para comparación (seguro)
      signatureComparison: templateVariants.map((template, i) => ({
        format: i + 1,
        template: template,
        expected: crypto.createHmac('sha256', webhookSecret).update(template, 'utf8').digest('hex').substring(0, 8),
        received: v1.substring(0, 8),
        match: v1 === crypto.createHmac('sha256', webhookSecret).update(template, 'utf8').digest('hex')
      }))
    });

    return {
      ok: validSignature !== null,
      dataId: dataId || undefined,
      error: validSignature === null ? 'Signature mismatch - probados múltiples formatos' : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validación de timestamp y prevención de replay attacks
 * Usa Redis/DB para persistencia en serverless (Vercel)
 */
async function validateTimestampAndReplay(xRequestId: string | null): Promise<{
  valid: boolean;
  error?: string;
  warning?: string;
}> {
  if (!xRequestId) {
    return { valid: true }; // No hay timestamp para validar
  }

  const timestamp = extractTimestampFromRequestId(xRequestId);
  if (!timestamp) {
    return { valid: true }; // Formato desconocido, permitir
  }

  const now = Math.floor(Date.now() / 1000);
  const ageSeconds = now - timestamp;

  // Rechazar webhooks más viejos de 5 minutos
  if (ageSeconds > 300) {
    logger.error('[HMAC] Timestamp muy antiguo (posible replay attack)', {
      timestamp,
      now,
      ageSeconds,
      xRequestId,
    });
    
    return { valid: false, error: 'Timestamp too old - possible replay attack' };
  }

  // VERIFICACIÓN DE DUPLICADOS con persistencia
  try {
    // Intentar usar Redis si está disponible (mejor performance)
    if (globalThis._redisClient) {
      const redisKey = `webhook_replay:${xRequestId}`;
      const exists = await globalThis._redisClient.exists(redisKey);
      
      if (exists) {
        logger.warn('[HMAC] Request duplicado detectado (Redis)', {
          xRequestId,
        });
        return { valid: true, warning: 'Request duplicado ignorado' };
      }
      
      // Guardar en Redis con TTL de 5 minutos
      await globalThis._redisClient.setex(redisKey, 300, '1');
      return { valid: true };
    }
    
    // Fallback a base de datos si Redis no está disponible
    const { db } = await import('@/lib/db');
    const { webhookReplayCache } = await import('@/lib/schema');
    const { eq } = await import('drizzle-orm');
    
    // Verificar si ya existe
    const existing = await db.query.webhookReplayCache.findFirst({
      where: eq(webhookReplayCache.requestId, xRequestId),
    });
    
    if (existing) {
      logger.warn('[HMAC] Request duplicado detectado (DB)', {
        xRequestId,
        cachedAt: existing.createdAt,
      });
      return { valid: true, warning: 'Request duplicado ignorado' };
    }
    
    // Insertar nuevo registro
    await db.insert(webhookReplayCache).values({
      requestId: xRequestId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000), // 5 minutos
    });
    
    // Limpiar registros expirados (background task)
    cleanupExpiredReplayCache().catch(err => {
      logger.warn('[HMAC] Error limpiando cache expirado', { error: err.message });
    });
    
    return { valid: true };
    
  } catch (error) {
    // Si falla la persistencia, permitir pero loguear advertencia
    logger.warn('[HMAC] Error verificando replay cache, permitiendo request', {
      xRequestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { valid: true };
  }
}

/**
 * Limpia registros expirados del cache de replay
 */
async function cleanupExpiredReplayCache(): Promise<void> {
  try {
    const { db } = await import('@/lib/db');
    const { webhookReplayCache } = await import('@/lib/schema');
    const { lt, and } = await import('drizzle-orm');
    
    await db.delete(webhookReplayCache)
      .where(and(
        lt(webhookReplayCache.expiresAt, new Date())
      ));
  } catch {
    // Silenciar errores en limpieza para no afectar el flujo principal
  }
}

/**
 * Logging de diagnóstico en modo desarrollo
 */
function logDiagnosticInfo(
  rawBody: string,
  template: string,
  xSignature: string | null,
  xRequestId: string | null,
  dataIdFromUrl: string | null,
  clientIp: string | undefined,
  webhookSecret: string
): void {
  if (process.env.NODE_ENV !== 'development' && process.env.DEBUG_HMAC !== 'true') {
    return;
  }

  logger.info('[HMAC-HEX] Análisis de bytes', {
    rawBodyHex: Buffer.from(rawBody, 'utf-8').toString('hex').substring(0, 200),
    rawBodyBase64: Buffer.from(rawBody, 'utf-8').toString('base64').substring(0, 100),
    rawBodyLength: rawBody.length,
    templateHex: Buffer.from(template, 'utf-8').toString('hex').substring(0, 200),
    templateLength: template.length,
  });

  // Log completo en producción para diagnóstico
  if (process.env.NODE_ENV === 'production') {
    logger.info('[HMAC-DEBUG] Datos completos', {
      xSignature,
      xRequestId,
      dataIdFromUrl,
      clientIp,
      webhookSecretLength: webhookSecret.length,
      webhookSecretPreview: `${webhookSecret.slice(0, 8)}...${webhookSecret.slice(-8)}`,
      rawBodyPreview: rawBody.slice(0, 200),
    });
  }
}

/**
 * Función principal de validación de webhook
 */
export async function verifyWebhookSignature(
  rawBody: string,
  xSignature: string | null,
  xRequestId: string | null,
  webhookSecret: string,
  dataIdFromUrl: string | null,
  clientIp?: string
): Promise<WebhookValidationResult> {
  try {
    // 1. Desarrollo sin secret → permitir
    if (process.env.NODE_ENV === 'development' && !webhookSecret) {
      try {
        const p = JSON.parse(rawBody);
        return { isValid: true, dataId: p?.data?.id ?? undefined };
      } catch {
        return { isValid: true };
      }
    }

    // 1.5. Bypass para simulador MP (solo con variable explícita)
    if (process.env.ALLOW_SIMULATOR_WEBHOOKS === 'true' && 
        (rawBody.includes('test.notification') || dataIdFromUrl === '123456')) {
      logger.warn('[HMAC] Bypass para simulador activado', {
        reason: 'simulator_detected',
        dataId: dataIdFromUrl,
        environment: process.env.NODE_ENV,
      });
      try {
        const p = JSON.parse(rawBody);
        return { isValid: true, dataId: p?.data?.id ?? dataIdFromUrl ?? undefined, warning: 'Simulator bypass' };
      } catch {
        return { isValid: true, warning: 'Simulator bypass' };
      }
    }

    // 2. Validación de timestamp y replay attacks
    const timestampValidation = await validateTimestampAndReplay(xRequestId);
    if (!timestampValidation.valid) {
      return { isValid: false, error: timestampValidation.error };
    }
    if (timestampValidation.warning) {
      return { isValid: true, dataId: dataIdFromUrl || undefined, warning: timestampValidation.warning };
    }

    // 3. Validación HMAC oficial
    const headers = new Headers();
    if (xSignature) headers.set('x-signature', xSignature);
    if (xRequestId) headers.set('x-request-id', xRequestId);

    const hmacResult = await validateMercadoPagoHmac(
      rawBody,
      headers,
      webhookSecret,
      dataIdFromUrl
    );

    // Si HMAC es válido, retornar éxito
    if (hmacResult.ok) {
      return { isValid: true, dataId: hmacResult.dataId };
    }

    // 4. Logging de diagnóstico (después de validar que HMAC falló)
    const template = `id:${dataIdFromUrl || 'unknown'};request-id:${xRequestId};ts:unknown`;
    logDiagnosticInfo(
      rawBody,
      template,
      xSignature,
      xRequestId,
      dataIdFromUrl,
      clientIp,
      webhookSecret
    );

    // 5. ERROR FINAL - Sin fallback IP (no recomendado por Mercado Pago)
    logger.error('[HMAC] Validación fallida - Mercado Pago recomienda solo HMAC', {
      clientIp,
      hmacError: hmacResult.error,
      recommendation: 'Verificar que MERCADO_PAGO_WEBHOOK_SECRET coincida con dashboard MP',
      ipValidationDisabled: true,
      mpGuideline: 'Usar únicamente validación HMAC, no IP whitelist'
    });

    // Console.log temporal para diagnóstico (sin agregar IPs automáticamente)
    if (clientIp) {
      console.log(`🔍 IP recibida: ${clientIp} - NO agregar a whitelist (arreglar HMAC)`);
    }
    
    return { isValid: false, error: hmacResult.error };
    
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Valida la estructura del payload del webhook
 */
export function validateWebhookPayload(rawBody: string): {
  isValid: boolean;
  action?: string;
  dataId?: string;
  error?: string;
} {
  try {
    const p = JSON.parse(rawBody);
    
    // Webhook de prueba
    if (p?.action === 'test.notification') {
      return { isValid: true, action: p.action };
    }

    // Extraer dataId de múltiples formatos
    const dataId = p?.data?.id ?? 
                   p?.id ?? 
                   (p?.resource ? String(p.resource).match(/(\d+)$/)?.[1] : undefined);
    
    const action = p.action || p.topic;

    if (!action || !dataId) {
      return { isValid: false, error: 'Estructura inválida: falta action o dataId' };
    }

    return { isValid: true, action, dataId };
  } catch {
    return { isValid: false, error: 'JSON inválido' };
  }
}

// Legacy exports para compatibilidad
export async function verifyHmacSHA256(
  xSignature: string | undefined,
  rawBody: string,
  webhookSecret: string,
  xRequestId?: string | null,
  dataIdFromUrl?: string | null
): Promise<WebhookValidationResult> {
  return verifyWebhookSignature(
    rawBody,
    xSignature || null,
    xRequestId || null,
    webhookSecret,
    dataIdFromUrl || null
  );
}
