import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

export interface WebhookValidationResult {
  isValid: boolean;
  dataId?: string;
  error?: string;
}

// Validar firma HMAC SHA256 de Mercado Pago (versión oficial)
export function verifyHmacSHA256(
  xSignature: string | undefined,
  rawBody: string,
  webhookSecret: string
): { isValid: boolean; dataId?: string; error?: string } {
  logger.info('Iniciando validación HMAC SHA256', {
    hasXSignature: !!xSignature,
    xSignatureLength: xSignature?.length,
    rawBodyLength: rawBody.length,
    webhookSecretSet: !!webhookSecret,
    webhookSecretLength: webhookSecret.length,
    rawXSignature: xSignature
  });

  // Si no hay x-signature, podría ser un webhook de prueba o tipo especial
  if (!xSignature) {
    logger.warn('No se recibió header x-signature, verificando si es webhook de prueba');
    
    try {
      const parsedPayload = JSON.parse(rawBody);
      if (parsedPayload.action === 'test.notification' || 
          (parsedPayload.type && !parsedPayload.data?.id && !parsedPayload.id)) {
        logger.info('Webhook de prueba o type-only detectado sin firma, aceptando', {
          action: parsedPayload.action,
          type: parsedPayload.type
        });
        return { isValid: true };
      }
    } catch (e) {
      logger.error('Error parseando payload para verificar webhook de prueba', {
        error: e instanceof Error ? e.message : String(e)
      });
    }
    
    logger.error('Header x-signature faltante para webhook que requiere validación');
    return {
      isValid: false,
      error: 'Header x-signature requerido'
    };
  }

  // Parsear header x-signature (formato: ts=123,v1=abc)
  let ts: string | undefined;
  let signature: string | undefined;
  
  // TEMPORAL: Log del header completo para debugging
  logger.info('DEBUG - Header x-signature completo', {
    rawXSignature: xSignature,
    xSignatureType: typeof xSignature,
    xSignatureLength: xSignature?.length
  });
  
  try {
    const signatureParts = xSignature.split(',');
    logger.info('DEBUG - Partes del signature parseadas', {
      signatureParts,
      partsCount: signatureParts.length
    });
    
    for (const part of signatureParts) {
      if (part.startsWith('ts=')) {
        ts = part.substring(3);
      } else if (part.startsWith('v1=')) {
        signature = part.substring(3);
      }
    }
    
    logger.info('DEBUG - Componentes extraídos', {
      ts,
      signature,
      hasTs: !!ts,
      hasSignature: !!signature
    });
  } catch (parseError) {
    logger.error('Error parseando header x-signature', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      xSignature
    });
    return {
      isValid: false,
      error: 'Formato de x-signature inválido'
    };
  }

  if (!ts || !signature) {
    logger.error('Componentes faltantes en x-signature', {
      xSignature,
      hasTs: !!ts,
      hasSignature: !!signature
    });
    return {
      isValid: false,
      error: 'Formato de firma inválido: faltan ts o v1'
    };
  }

  // TEMPORAL: Console.log directo para debugging sin redacción
  console.log('=== WEBHOOK DEBUG RAW ===');
  console.log('RAW PAYLOAD:', rawBody);
  console.log('RAW X-SIGNATURE:', xSignature);
  console.log('========================');

  // Parsear el payload para obtener data.id
  let parsedPayload: Record<string, unknown>;
  try {
    parsedPayload = JSON.parse(rawBody);
    console.log('PARSED PAYLOAD:', JSON.stringify(parsedPayload, null, 2));
  } catch (parseError) {
    logger.error('Error parseando payload JSON', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      rawBodyLength: rawBody.length
    });
    return {
      isValid: false,
      error: 'Payload JSON inválido'
    };
  }

  // Permitir webhooks de prueba y tipar payload
  const p = parsedPayload as {
    action?: string;
    type?: string;
    data?: { id?: unknown };
    id?: unknown;
    topic?: string;
    resource?: string;
  };

  // TEMPORAL: Log completo para debugging de payload real
  logger.info('DEBUG - Payload completo sin redactar', {
    rawPayload: JSON.stringify(parsedPayload, null, 2),
    payloadKeys: Object.keys(parsedPayload),
    hasAction: !!p.action,
    hasType: !!p.type,
    hasData: !!p.data,
    hasDataId: !!p.data?.id,
    hasTopLevelId: !!p.id,
    hasTopic: !!p.topic,
    hasResource: !!p.resource,
    actionValue: p.action,
    typeValue: p.type,
    dataIdValue: p.data?.id,
    topLevelIdValue: p.id,
    topicValue: p.topic,
    resourceValue: p.resource
  });

  // Permitir webhooks de prueba (action format)
  if (p.action === 'test.notification') {
    logger.info('Webhook de prueba recibido, saltando validación');
    return { isValid: true };
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
      logger.info('ID extraído de merchant_order resource', {
        resource: p.resource,
        extractedId: dataId
      });
    }
  }
  // Estructura alternativa: {action, type} sin id (ignorar)
  else {
    const hasType = p.type;
    const hasDataId = p.data?.id;
    const hasTopLevelId = p.id;
    
    if (hasType && !hasDataId && !hasTopLevelId) {
      logger.warn('Webhook con estructura type-only, aceptando sin validación completa', {
        action: p.action,
        type: hasType
      });
      return { isValid: true };
    }
  }

  if (!dataId || dataId === 'undefined' || dataId === 'null') {
    logger.error('No se pudo extraer data.id del payload', {
      payloadStructure: Object.keys(parsedPayload),
      dataField: p.data,
      dataId: p.data?.id,
      topLevelId: p.id,
      rawBody: rawBody.substring(0, 200) + '...'
    });
    return {
      isValid: false,
      error: 'Estructura de payload inválida: falta data.id'
    };
  }

  // Construir string a firmar según especificación oficial de Mercado Pago
  const stringToSign = `id=${dataId}&ts=${ts}`;
  
  console.log('=== HMAC DEBUG ===');
  console.log('DATA ID:', dataId);
  console.log('TIMESTAMP:', ts);
  console.log('STRING TO SIGN:', stringToSign);
  console.log('WEBHOOK SECRET LENGTH:', webhookSecret.length);
  console.log('==================');
  
  logger.info('Construyendo string para validación HMAC', {
    ts,
    dataId,
    stringToSign,
    webhookSecretSet: !!webhookSecret
  });
  
  // Generar HMAC-SHA256
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(stringToSign);
  const expectedSignature = hmac.digest('hex');

  console.log('EXPECTED SIGNATURE:', expectedSignature);
  console.log('RECEIVED SIGNATURE:', signature);
  console.log('SIGNATURES MATCH:', signature === expectedSignature);
  console.log('==================');

  // Comparar firmas de forma segura
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );

  logger.info('Resultado de validación HMAC', {
    ts,
    dataId,
    stringToSign,
    receivedSignature: signature,
    expectedSignature,
    signaturesMatch: isValid
  });

  return {
    isValid,
    dataId,
    error: isValid ? undefined : 'Firma inválida'
  };
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

    // Intentar validación oficial primero
    const officialResult = verifyHmacSHA256(xSignature || undefined, rawBody, webhookSecret);
    if (officialResult.isValid) {
      return officialResult;
    }

    // Si la validación oficial falla, intentar formatos alternativos para compatibilidad
    logger.warn('Validación oficial falló, intentando formatos alternativos', {
      xSignature,
      xRequestId,
      officialError: officialResult.error
    });

    // Formato alternativo: header x-hook-signature (versiones antiguas)
    const xHookSignature = xSignature; // Mismo header pero diferente formato
    
    if (xHookSignature && xHookSignature.startsWith('sha256=')) {
      const signature = xHookSignature.replace('sha256=', '');
      
      try {
        const parsed = JSON.parse(rawBody);
        const dataId = parsed?.data?.id ? String(parsed.data.id) : undefined;
        
        if (dataId) {
          const hmac = crypto.createHmac('sha256', webhookSecret);
          hmac.update(rawBody);
          const expectedSignature = hmac.digest('hex');
          
          const isValid = crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
          );

          if (isValid) {
            logger.info('Validación alternativa exitosa (formato sha256=)', {
              dataId,
              signature: signature.substring(0, 16) + '...'
            });
            
            return {
              isValid: true,
              dataId
            };
          }
        }
      } catch (altError) {
        // Error en validación alternativa - loggear pero no relanzar
        logger.error('Error en validación alternativa', {
          error: altError instanceof Error ? altError.message : String(altError)
        });
      }
    }

    // Si todos los métodos fallan, retornar error de validación oficial
    return officialResult;

  } catch (error) {
    logger.error('Error crítico en validación de webhook', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      isValid: false,
      error: 'Error crítico en validación'
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
