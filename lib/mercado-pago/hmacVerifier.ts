// lib/mercado-pago/hmacVerifier.ts

import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

export interface WebhookValidationResult {
  isValid: boolean;
  dataId?: string;
  error?: string;
}

export interface MercadoPagoHmacValidationResult {
  ok: boolean;
  dataId?: string;
  error?: string;
}

function isEmptyOrNull(value: string | null): boolean {
  return !value || value.trim() === '';
}

export async function validateMercadoPagoHmac(
  rawBody: string,
  headers: Headers,
  webhookSecret: string,
  dataIdFromUrl: string | null
): Promise<MercadoPagoHmacValidationResult> {
  const xSignature = headers.get('x-signature');
  const xRequestId = headers.get('x-request-id');
  
  // Extraer dataId del body si no viene en URL
  let dataId = dataIdFromUrl;
  if (!dataId) {
    try {
      const parsed = JSON.parse(rawBody);
      dataId = parsed?.data?.id ?? parsed?.id;
    } catch {
      /* ignore */
    }
  }

  if (!dataId) {
    return { ok: false, error: 'No se pudo encontrar data.id' };
  }

  // Validación simple según MercadoLibre
  if (verifySignatureOfProvider(xSignature, xRequestId, dataId)) {
    return { ok: true, dataId };
  }

  return { ok: false, error: 'Firma inválida' };
}

function verifySignatureOfProvider(
  signature: string | null, 
  xRequestId: string | null, 
  dataId: string | null
): boolean {
  if (isEmptyOrNull(signature) || isEmptyOrNull(xRequestId) || isEmptyOrNull(dataId)) {
    return false;
  }

  const [timestamp, xSignature] = signature!.split(',');
  const [, valueOfTimestamp] = timestamp.split('=');
  const [, valueOfXSignature] = xSignature.split('=');

  // Logging detallado para diagnóstico
  logger.debug('[HMAC] Componentes de validación', {
    dataId,
    xRequestId,
    timestamp: valueOfTimestamp,
    receivedSignature: valueOfXSignature?.slice(0, 20) + '...',
    secretPresent: !!process.env.MERCADO_PAGO_WEBHOOK_SECRET,
    secretLength: process.env.MERCADO_PAGO_WEBHOOK_SECRET?.length
  });

  const signatureTemplateParsed = `id:${dataId};request-id:${xRequestId};ts:${valueOfTimestamp};`;
  
  logger.debug('[HMAC] Template construido', {
    template: signatureTemplateParsed,
    templateLength: signatureTemplateParsed.length
  });

  const cyphedSignature = crypto
    .createHmac('sha256', process.env.MERCADO_PAGO_WEBHOOK_SECRET!)
    .update(signatureTemplateParsed)
    .digest('hex');

  logger.debug('[HMAC] Resultado validación', {
    expectedSignature: cyphedSignature.slice(0, 20) + '...',
    signaturesMatch: valueOfXSignature === cyphedSignature,
    receivedLength: valueOfXSignature?.length,
    expectedLength: cyphedSignature.length
  });

  return valueOfXSignature === cyphedSignature;
}

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

export async function verifyWebhookSignature(
  rawBody: string,
  xSignature: string | null,
  xRequestId: string | null,
  webhookSecret: string,
  dataIdFromUrl: string | null,
  clientIp?: string
): Promise<WebhookValidationResult> {
  try {
    // Desarrollo sin secret → permite
    if (process.env.NODE_ENV === 'development' && !webhookSecret) {
      try {
        const p = JSON.parse(rawBody);
        return { isValid: true, dataId: p?.data?.id ?? undefined };
      } catch {
        return { isValid: true };
      }
    }

    // Primero intentar validación HMAC con logging detallado
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

    // Si HMAC falla, verificar fallback IP whitelist en producción
    if (process.env.NODE_ENV === 'production' && clientIp && isMercadoPagoIp(clientIp)) {
      logger.warn('[HMAC] Fallback por IP whitelist de Mercado Pago', {
        clientIp,
        reason: 'HMAC_validation_failed_but_IP_whitelisted',
        hmacError: hmacResult.error
      });
      
      try {
        const p = JSON.parse(rawBody);
        return { isValid: true, dataId: p?.data?.id ?? undefined };
      } catch {
        return { isValid: true };
      }
    }

    // Si no hay fallback, retornar error HMAC
    return { isValid: false, error: hmacResult.error };
    
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// IPs oficiales de Mercado Pago (Argentina y Brasil principalmente)
function isMercadoPagoIp(ip: string): boolean {
  const mercadoPagoRanges = [
    // Mercado Pago Argentina
    { ip: '52.200.68.0', mask: 24 },
    { ip: '54.79.89.0', mask: 24 },
    { ip: '54.94.232.0', mask: 24 },
    { ip: '54.207.48.0', mask: 24 },
    { ip: '54.232.208.0', mask: 24 },
    { ip: '54.233.226.0', mask: 24 },
    { ip: '18.231.92.0', mask: 24 },
    { ip: '18.228.52.0', mask: 24 },
    { ip: '18.229.12.0', mask: 24 },
    { ip: '18.230.12.0', mask: 24 },
    // Mercado Pago Brasil
    { ip: '177.104.160.0', mask: 20 },
    { ip: '186.192.80.0', mask: 20 },
    { ip: '189.8.88.0', mask: 21 },
    { ip: '200.147.32.0', mask: 19 }
  ];

  // Validar formato de IP básico
  if (!isValidIpFormat(ip)) {
    return false;
  }

  // Verificar si IP está en rangos permitidos usando CIDR proper
  return mercadoPagoRanges.some(range => {
    return ipInCidr(ip, range.ip, range.mask);
  });
}

function isValidIpFormat(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

function ipInCidr(ip: string, cidr: string, mask: number): boolean {
  try {
    // Convertir IP a número de 32 bits
    const ipNum = ipToLong(ip);
    const cidrNum = ipToLong(cidr);
    
    // Crear máscara de subnet
    const maskLong = (0xffffffff << (32 - mask)) >>> 0;
    
    // Aplicar máscara y comparar
    return (ipNum & maskLong) === (cidrNum & maskLong);
  } catch (error) {
    logger.error('[HMAC] Error en validación CIDR', {
      ip,
      cidr,
      mask,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function ipToLong(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new Error('Formato IP inválido');
  }
  
  let result = 0;
  for (let i = 0; i < 4; i++) {
    const part = parseInt(parts[i], 10);
    if (isNaN(part) || part < 0 || part > 255) {
      throw new Error('Octeto IP inválido');
    }
    result = (result << 8) + part;
  }
  
  // Convertir a unsigned 32-bit
  return result >>> 0;
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
