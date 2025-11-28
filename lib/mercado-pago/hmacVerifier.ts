import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  dataId?: string;
}

// Validar firma HMAC SHA256 de Mercado Pago (versión oficial)
export function verifyHmacSHA256(
  rawBody: string,
  xSignature: string | null,
  xRequestId: string | null,
  webhookSecret: string
): WebhookValidationResult {
  try {
    // Validar parámetros básicos
    if (!webhookSecret) {
      return {
        isValid: false,
        error: 'Webhook secret no configurado'
      };
    }

    if (!xSignature || !xRequestId) {
      return {
        isValid: false,
        error: 'Faltan headers de validación'
      };
    }

    // Extraer timestamp y firma del header x-signature
    const signatureParts = xSignature.split(',');
    let ts = '';
    let signature = '';

    for (const part of signatureParts) {
      if (part.startsWith('ts=')) {
        ts = part.substring(3);
      } else if (part.startsWith('v1=')) {
        signature = part.substring(3);
      }
    }

    if (!ts || !signature) {
      return {
        isValid: false,
        error: 'Formato de firma inválido'
      };
    }

    // Parsear el payload para obtener data.id (después de validar estructura básica)
    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(rawBody);
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

    // Validar estructura del payload
    if (!parsedPayload.data || !(parsedPayload.data as { id: unknown })?.id) {
      logger.error('Estructura de payload inválida: falta data.id', {
        payloadStructure: Object.keys(parsedPayload),
        dataField: parsedPayload.data,
        dataId: (parsedPayload.data as { id: unknown })?.id,
        rawBody: rawBody.substring(0, 200) + '...' // Primeros 200 chars para debug
      });
      return {
        isValid: false,
        error: 'Estructura de payload inválida: falta data.id'
      };
    }

    // Normalizar dataId a string
    const dataId = String((parsedPayload.data as { id: unknown }).id);
    
    if (!dataId || dataId === 'undefined' || dataId === 'null') {
      logger.error('data.id inválido o vacío', {
        rawId: (parsedPayload.data as { id: unknown }).id,
        stringifiedId: dataId
      });
      return {
        isValid: false,
        error: 'data.id inválido o vacío'
      };
    }

    // Construir string a firmar según especificación oficial de Mercado Pago
    const stringToSign = `${ts}.${dataId}`;
    
    logger.info('Validación HMAC - Mercado Pago Oficial', {
      ts,
      dataId,
      dataIdType: typeof dataId,
      stringToSign,
      webhookSecretSet: !!webhookSecret,
      webhookSecretLength: webhookSecret.length
    });
    
    // Generar HMAC-SHA256
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(stringToSign);
    const expectedSignature = hmac.digest('hex');

    // Comparar firmas de forma segura
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    logger.info('Validación de firma - Resultado', {
      ts,
      requestId: xRequestId,
      dataId,
      stringToSign,
      receivedSignature: signature,
      expectedSignature: expectedSignature,
      signaturesMatch: isValid,
      webhookSecretConfigured: !!webhookSecret,
      webhookSecretLength: webhookSecret?.length || 0,
      webhookSecretPrefix: webhookSecret ? webhookSecret.substring(0, 8) + '...' : 'none'
    });

    return {
      isValid,
      dataId,
      error: isValid ? undefined : 'Firma inválida'
    };

  } catch (error) {
    logger.error('Error validando firma HMAC', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      isValid: false,
      error: 'Error en validación de firma'
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

    // Intentar validación oficial primero
    const officialResult = verifyHmacSHA256(rawBody, xSignature, xRequestId, webhookSecret);
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
    
    if (!parsed.action || !parsed.data || !parsed.data.id) {
      return {
        isValid: false,
        error: 'Estructura inválida: faltan campos action o data.id'
      };
    }

    return {
      isValid: true,
      action: parsed.action,
      dataId: String(parsed.data.id)
    };
    
  } catch {
    return {
      isValid: false,
      error: 'JSON inválido'
    };
  }
}
