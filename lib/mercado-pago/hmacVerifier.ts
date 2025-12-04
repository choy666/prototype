// lib/mercado-pago/hmacVerifier.ts

import crypto from 'crypto';

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

  const signatureTemplateParsed = `id:${dataId};request-id:${xRequestId};ts:${valueOfTimestamp};`;
  const cyphedSignature = crypto
    .createHmac('sha256', process.env.MERCADO_PAGO_WEBHOOK_SECRET!)
    .update(signatureTemplateParsed)
    .digest('hex');

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
  dataIdFromUrl: string | null
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
