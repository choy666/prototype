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
}

function getHeader(headers: Headers, name: string): string | null {
  try {
    return headers.get(name);
  } catch {
    return null;
  }
}

// Validación estricta HMAC SHA256 v1 de Mercado Pago
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

  const xSignature = getHeader(headers, 'x-signature');
  const xRequestId = getHeader(headers, 'x-request-id');

  logger.info('Headers clave para HMAC recibidos', {
    hasXSignature: !!xSignature,
    hasXRequestId: !!xRequestId,
  });

  if (!xSignature) {
    // Permitir webhooks de prueba sin firma
    try {
      const parsedPayload = JSON.parse(rawBody);
      if ((parsedPayload as { action?: string }).action === 'test.notification') {
        logger.info('Webhook de prueba detectado sin firma, aceptando', {
          action: (parsedPayload as { action?: string }).action,
        });
        return { ok: true };
      }
    } catch (e) {
      logger.error('Error parseando payload sin firma para detectar test.notification', {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    logger.error('Header x-signature faltante para webhook que requiere validación');
    throw new Error('Header x-signature requerido');
  }

  if (!xRequestId) {
    logger.error('Header x-request-id faltante para validación HMAC oficial');
    throw new Error('Header x-request-id requerido para validación HMAC');
  }

  // Parsear header x-signature (formato: ts=123,v1=abc)
  let ts: string | undefined;
  let signature: string | undefined;

  logger.info('DEBUG - Header x-signature completo', {
    rawXSignature: xSignature,
    xSignatureLength: xSignature.length,
  });

  try {
    const signatureParts = xSignature.split(',');

    for (const rawPart of signatureParts) {
      const part = rawPart.trim();
      if (!part) continue;

      const [key, value] = part.split('=');
      if (key === 'ts') {
        ts = value;
      } else if (key === 'v1') {
        signature = value;
      }
    }

    logger.info('DEBUG - Componentes extraídos de x-signature', {
      ts,
      hasTs: !!ts,
      hasSignature: !!signature,
    });
  } catch (parseError) {
    logger.error('Error parseando header x-signature', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      xSignature,
    });
    throw new Error('Formato de x-signature inválido');
  }

  if (!ts || !signature) {
    logger.error('Componentes faltantes en x-signature', {
      xSignature,
      hasTs: !!ts,
      hasSignature: !!signature,
    });
    throw new Error('Formato de firma inválido: faltan ts o v1');
  }

  // Parsear el payload para obtener data.id
  let parsedPayload: Record<string, unknown>;
  try {
    parsedPayload = JSON.parse(rawBody);
  } catch (parseError) {
    logger.error('Error parseando payload JSON en validateMercadoPagoHmac', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      rawBodyLength: rawBody.length,
    });
    throw new Error('Payload JSON inválido');
  }

  const p = parsedPayload as {
    action?: string;
    data?: { id?: unknown };
  };

  if (p.action === 'test.notification') {
    logger.info('Webhook de prueba recibido (con firma), saltando validación estricta');
    return { ok: true };
  }

  const dataIdRaw = p.data?.id;

  if (!dataIdRaw) {
    logger.error('No se pudo extraer data.id del payload para construir string_to_sign', {
      payloadKeys: Object.keys(parsedPayload),
      dataField: p.data,
    });
    throw new Error('Estructura de payload inválida: falta data.id');
  }

  const dataId = String(dataIdRaw);

  // Construir string_to_sign EXACTO según especificación oficial
  const stringToSign = `id:${dataId};request-id:${xRequestId};ts:${ts}`;

  logger.info('Construyendo string_to_sign para validación HMAC', {
    dataId,
    ts,
    requestIdHeader: xRequestId,
  });

  // Generar HMAC-SHA256 sobre el string_to_sign
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(stringToSign);
  const expectedSignature = hmac.digest('hex');

  if (signature.length !== expectedSignature.length) {
    logger.error('Longitud de firma inválida', {
      receivedLength: signature.length,
      expectedLength: expectedSignature.length,
    });
    throw new Error('Firma inválida');
  }

  const receivedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  const signaturesMatch = crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

  logger.info('Resultado de validación HMAC', {
    dataId,
    ts,
    signaturesMatch,
    receivedSignaturePreview: signature.substring(0, 16),
    expectedSignaturePreview: expectedSignature.substring(0, 16),
  });

  if (!signaturesMatch) {
    throw new Error('Firma inválida');
  }

  return {
    ok: true,
    dataId,
  };
}

// Validar firma HMAC SHA256 de Mercado Pago (versión oficial)
export function verifyHmacSHA256(
  xSignature: string | undefined,
  rawBody: string,
  webhookSecret: string,
  xRequestId?: string | null
): { isValid: boolean; dataId?: string; error?: string } {
  logger.info('Iniciando validación HMAC SHA256', {
    hasXSignature: !!xSignature,
    xSignatureLength: xSignature?.length,
    rawBodyLength: rawBody.length,
    webhookSecretSet: !!webhookSecret,
    webhookSecretLength: webhookSecret.length,
    rawXSignature: xSignature
  });

  try {
    const headers = new Headers();

    if (xSignature) {
      headers.set('x-signature', xSignature);
    }

    if (xRequestId) {
      headers.set('x-request-id', xRequestId);
    }

    const result = validateMercadoPagoHmac(rawBody, headers, webhookSecret);

    return {
      isValid: result.ok,
      dataId: result.dataId
    };
  } catch (error) {
    logger.error('Error en verifyHmacSHA256', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Error en validación HMAC'
    };
  }
}
// Validar firma con soporte para múltiples formatos (compatibilidad)
export function verifyWebhookSignature(
  rawBody: string,
  xSignature: string | null,
  xRequestId: string | null,
  webhookSecret: string
): WebhookValidationResult {
  try {
    // En desarrollo, saltar validación si no hay firma configurada
    if (process.env.NODE_ENV === 'development' && !webhookSecret) {
      logger.warn('Modo desarrollo: Saltando validación de firma (webhook secret no configurado)');
      
      // Parsear para obtener dataId anyway
      try {
        const parsed = JSON.parse(rawBody);
        return {
          isValid: true,
          dataId: parsed?.data?.id ? String(parsed.data.id) : undefined
        };
      } catch {
        return {
          isValid: true,
          dataId: undefined
        };
      }
    }

    const headers = new Headers();

    if (xSignature) {
      headers.set('x-signature', xSignature);
    }

    if (xRequestId) {
      headers.set('x-request-id', xRequestId);
    }

    const result = validateMercadoPagoHmac(rawBody, headers, webhookSecret);

    return {
      isValid: result.ok,
      dataId: result.dataId
    };

  } catch (error) {
    logger.error('Error crítico en validación de webhook', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Error crítico en validación'
    };
  }
}

// Función helper para validar estructura del payload (usada después de validar firma)
export function validateWebhookPayload(rawBody: string): {
  isValid: boolean;
  action?: string;
  dataId?: string;
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawBody);
    
    // Tipar payload con todas las estructuras posibles
    const p = parsed as {
      action?: string;
      type?: string;
      data?: { id?: unknown };
      id?: unknown;
      topic?: string;
      resource?: string;
    };
    
    // Permitir webhooks de prueba (action format)
    if (p.action === 'test.notification') {
      return {
        isValid: true,
        action: p.action
      };
    }
    
    // Extraer data.id de diferentes estructuras posibles
    let dataId: string | undefined;
    
    // Estructura estándar: {action, data: {id}}
    if (p.data?.id) {
      dataId = String(p.data.id);
    }
    // Estructura alternativa: {action, type, id} (IPN style)
    else if (p.id) {
      dataId = String(p.id);
    }
    // Estructura merchant_order: {topic, resource}
    else if (p.topic === 'merchant_order' && p.resource) {
      // Extraer ID de la URL: https://api.mercadolibre.com/merchant_orders/35935869461
      const match = p.resource.match(/\/(\d+)$/);
      if (match && match[1]) {
        dataId = match[1];
      }
    }
    else if (p.topic === 'payment' && p.resource) {
      const resourceStr = String(p.resource);
      const simpleIdMatch = resourceStr.match(/(\d+)$/);
      if (simpleIdMatch && simpleIdMatch[1]) {
        dataId = simpleIdMatch[1];
      }
    }
    // Estructura alternativa: {action, type} sin id (ignorar)
    else if (p.type && !p.data?.id && !p.id) {
      return {
        isValid: true,
        action: p.action
      };
    }
    
    // Validar que tengamos action o topic y dataId
    const hasActionOrTopic = p.action || p.topic;
    if (!hasActionOrTopic || !dataId) {
      logger.error('Estructura de payload inválida en validateWebhookPayload', {
        error: 'Faltan campos action/topic o data.id',
        payloadKeys: Object.keys(parsed),
        hasAction: !!p.action,
        hasTopic: !!p.topic,
        hasData: !!p.data,
        hasDataId: !!p.data?.id,
        hasTopLevelId: !!p.id,
        hasResource: !!p.resource,
        extractedDataId: dataId
      });
      return {
        isValid: false,
        error: 'Estructura inválida: faltan campos action/topic o data.id'
      };
    }

    return {
      isValid: true,
      action: p.action || p.topic,
      dataId
    };
    
  } catch (e) {
    logger.error('Error parseando JSON en validateWebhookPayload', {
        error: e instanceof Error ? e.message : String(e),
        rawBodyPreview: rawBody.substring(0, 100) + '...'
    });
    return {
      isValid: false,
      error: 'JSON inválido'
    };
  }
}
