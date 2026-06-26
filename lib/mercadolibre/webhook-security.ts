import crypto from 'node:crypto';

import { getMercadoLibreConfig } from '@/lib/config/integrations';

interface SignatureParts {
  algorithm: string;
  digest: string;
  raw: string;
}

function normalizeSignatureHeader(signatureHeader: string): SignatureParts {
  const raw = signatureHeader.trim();

  if (!raw.includes('=')) {
    return {
      algorithm: 'sha256',
      digest: raw,
      raw,
    };
  }

  const [algorithm, digest] = raw.split('=');
  return {
    algorithm: algorithm.trim().toLowerCase() || 'sha256',
    digest: digest.trim(),
    raw,
  };
}

export function verifyMercadoLibreWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secretOverride?: string | null
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const secret =
    secretOverride ??
    process.env.MERCADO_LIBRE_WEBHOOK_SECRET ??
    getMercadoLibreConfig().clientSecret;

  if (!secret) {
    throw new Error(
      'No se encontró ningún secreto para validar firmas de webhooks de Mercado Libre'
    );
  }

  const signatureParts = normalizeSignatureHeader(signatureHeader);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody, 'utf8');

  const digestHex = hmac.digest('hex');
  const digestBase64 = Buffer.from(digestHex, 'hex').toString('base64');

  const expectedVariants = new Set([
    digestHex,
    digestBase64,
    `sha256=${digestHex}`,
    `sha256=${digestBase64}`,
  ]);

  const receivedVariants = new Set([
    signatureParts.digest,
    signatureParts.raw,
    signatureHeader.trim(),
  ]);

  for (const candidate of receivedVariants) {
    if (expectedVariants.has(candidate)) {
      return true;
    }
  }

  return false;
}
