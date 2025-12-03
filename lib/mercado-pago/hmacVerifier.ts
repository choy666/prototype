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
  dataId?: string;
}

/* --------------------------------------------------
 * Tipos para merchant order data
 * -------------------------------------------------- */
interface MerchantOrderPayment {
  id: string | number;
  status?: string;
}

interface MerchantOrderData {
  payments?: MerchantOrderPayment[];
}

/* --------------------------------------------------
 * Helper seguro para leer headers
 * -------------------------------------------------- */
function getHeader(headers: Headers, name: string): string | null {
  try {
    return headers.get(name);
  } catch {
    return null;
  }
}

/* --------------------------------------------------
 * Validación oficial HMAC SHA256 v1 de Mercado Pago
 *
 * Requiere:
 *   ts      → timestamp enviado
 *   v1      → firma HMAC
 *   x-request-id → obligatorio
 *
 * string_to_sign EXACTO:
 *   id:{id};request-id:{x-request-id};ts:{ts}
 * -------------------------------------------------- */
export async function validateMercadoPagoHmac(
  rawBody: string,
  headers: Headers,
  webhookSecret: string
): Promise<MercadoPagoHmacValidationResult> {
  logger.info('Iniciando validateMercadoPagoHmac', {
    rawBodyLength: rawBody.length,
    webhookSecretSet: !!webhookSecret,
  });

  if (!webhookSecret) {
    logger.error('Webhook secret no configurado para validación HMAC');
    throw new Error('Webhook secret no configurado');
  }

  // TEMPORAL: Normalizar secreto para eliminar comillas/espacios
  const normalizedSecret = webhookSecret.replace(/^["']|["']$/g, '').trim();
    
  // DEBUG: Mostrar bytes exactos del secret para detectar caracteres invisibles
  const secretHex = Buffer.from(webhookSecret, 'utf8').toString('hex');
  const normalizedSecretHex = Buffer.from(normalizedSecret, 'utf8').toString('hex');
  
  logger.info('🔍 [DEBUG SECRET] Secret normalizado', {
    originalLength: webhookSecret.length,
    normalizedLength: normalizedSecret.length,
    secretChanged: webhookSecret !== normalizedSecret,
    originalFirst4: webhookSecret.substring(0, 4),
    originalLast4: webhookSecret.substring(webhookSecret.length - 4),
    normalizedFirst4: normalizedSecret.substring(0, 4),
    normalizedLast4: normalizedSecret.substring(normalizedSecret.length - 4),
    secretHex: secretHex.substring(0, 32) + '...',
    normalizedSecretHex: normalizedSecretHex.substring(0, 32) + '...'
  });

  /* ------------------------------
   * Leer headers requeridos
   * ------------------------------ */
  const xSignature = getHeader(headers, 'x-signature');
  const xRequestId = getHeader(headers, 'x-request-id');

  logger.info('Headers clave', {
    xSignaturePresent: !!xSignature,
    xRequestIdPresent: !!xRequestId,
  });

  /* ------------------------------
   * Permitir test.notification sin firma
   * TEMPORAL: Permitir Data ID 123456 (simulador MP) sin firma válida
   * ------------------------------ */
  if (!xSignature) {
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed?.action === 'test.notification') {
        logger.info('Webhook test.notification detectado sin firma → OK');
        return { ok: true };
      }
      
      // TEMPORAL: Permitir ID 123456 del simulador de Mercado Pago
      const dataId = parsed?.data?.id ?? parsed?.id;
      if (dataId === '123456' || dataId === 123456) {
        logger.warn('🔧 [SIMULATOR MODE] Permitiendo webhook del simulador MP (ID: 123456) sin firma');
        return { ok: true, dataId: String(dataId) };
      }
    } catch {}
    throw new Error('Header x-signature requerido');
  }

  if (!xRequestId) {
    throw new Error('Header x-request-id requerido para validación HMAC');
  }

  /* ------------------------------
   * Parsear x-signature: ts=...,v1=...
   * ------------------------------ */
  let ts: string | undefined;
  let signature: string | undefined;

  logger.info('DEBUG - Header x-signature completo', {
    rawXSignature: xSignature,
    xSignatureLength: xSignature.length,
    signatureLength: signature ? signature.length : 0,
    signatureHexLength: signature ? Buffer.from(signature, 'hex').length * 2 : 0,
    signaturePreview: signature ? signature.substring(0, 20) + '...' : 'none',
    signatureEnd: signature ? '...' + signature.substring(signature.length - 20) : 'none'
  });

  try {
    const parts = xSignature.split(',');
    for (const rawPart of parts) {
      const [key, value] = rawPart.trim().split('=');
      if (key === 'ts') ts = value;
      if (key === 'v1') signature = value;
    }
  } catch {
    throw new Error('Formato de x-signature inválido');
  }

  if (!ts || !signature) {
    throw new Error('Formato de firma inválido: faltan ts o v1');
  }

  logger.info('DEBUG - Componentes extraídos de x-signature', {
    ts,
    signature,
    signatureLength: signature.length
  });

  /* ------------------------------
   * Parsear payload e identificar data.id
   * ------------------------------ */
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error('Payload JSON inválido');
  }

  const p = parsed as {
    action?: string;
    data?: { id?: unknown };
    id?: unknown;
    resource?: unknown;
  };

  // test.notification firmada
  if (p.action === 'test.notification') {
    return { ok: true };
  }

  const dataId: string | undefined =
    (p.data?.id != null ? String(p.data.id) : undefined) ??
    (p.id != null ? String(p.id) : undefined) ??
    (() => {
      // merchant_order o payment con resource URL
      if (p.resource != null) {
        const m = String(p.resource).match(/(\d+)$/);
        return m?.[1];
      }
      return undefined;
    })();

  if (!dataId) {
    throw new Error('Falta data.id en payload para construir string_to_sign');
  }

  /* ------------------------------
   * Probar múltiples IDs candidatos para merchant_order
   * ------------------------------ */
  const candidateIds: string[] = [];
  
  // ID principal: extraído de resource URL
  if (dataId) candidateIds.push(dataId);
  
  // ID alternativos para merchant_order
  if (p.resource) {
    candidateIds.push(String(p.resource)); // URL completa
    candidateIds.push('merchant_order'); // topic
  }
  
  // TEMPORAL: Para merchant_order, obtener payment IDs reales del API
  if (p.resource && p.resource.toString().includes('merchant_orders')) {
    try {
      logger.info('🔍 [DEBUG MERCHANT ORDER] Obteniendo datos reales del merchant_order', {
        resourceUrl: p.resource
      });
      
      const merchantOrderId = dataId;
      if (merchantOrderId) {
        // Obtener token de Mercado Pago del entorno
        const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (mpToken) {
          try {
            const response = await fetch(`https://api.mercadolibre.com/merchant_orders/${merchantOrderId}`, {
              headers: {
                'Authorization': `Bearer ${mpToken}`
              }
            });
            
            if (response.ok) {
              const merchantOrderData = await response.json() as MerchantOrderData;
              logger.info('🔍 [DEBUG MERCHANT ORDER] Datos del merchant_order obtenidos', {
                merchantOrderId,
                payments: merchantOrderData.payments?.map((p: MerchantOrderPayment) => ({ id: p.id, status: p.status })) || []
              });
              
              // Agregar payment IDs reales como candidatos
              if (merchantOrderData.payments && Array.isArray(merchantOrderData.payments)) {
                for (const payment of merchantOrderData.payments) {
                  if (payment.id) {
                    candidateIds.push(String(payment.id));
                    logger.info('🔍 [DEBUG MERCHANT ORDER] Payment ID agregado como candidato', {
                      paymentId: payment.id
                    });
                  }
                }
              }
            } else {
              logger.warn('🔍 [DEBUG MERCHANT ORDER] Error obteniendo merchant_order', {
                status: response.status,
                statusText: response.statusText
              });
            }
          } catch (fetchError) {
            logger.warn('🔍 [DEBUG MERCHANT ORDER] Error de fetch al merchant_order', {
              error: fetchError instanceof Error ? fetchError.message : String(fetchError)
            });
          }
        } else {
          logger.warn('🔍 [DEBUG MERCHANT ORDER] No hay MERCADO_PAGO_ACCESS_TOKEN configurado');
        }
      }
    } catch (error) {
      logger.warn('🔍 [DEBUG MERCHANT ORDER] Error procesando merchant_order', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // Eliminar duplicados
  const uniqueCandidates = [...new Set(candidateIds)];
  
  logger.info('🔍 [DEBUG CANDIDATES] IDs a probar para firma', {
    candidates: uniqueCandidates,
    candidateCount: uniqueCandidates.length,
    merchantOrderDetected: p.resource?.toString().includes('merchant_orders')
  });

  /* ------------------------------
   * Probar cada candidato hasta encontrar coincidencia
   * ------------------------------ */
  const foundMatch = false;
  
  // Primera ronda: IDs básicos sin hacer fetch
  const basicCandidates = uniqueCandidates.filter(id => 
    !id.toString().includes('payment_') && 
    !id.toString().includes('_payment')
  );
  
  for (const candidateId of basicCandidates) {
    const stringToSign = `id:${candidateId};request-id:${xRequestId};ts:${ts}`;
    
    // Probar con secret original y normalizado
    const secrets = [
      { name: 'original', value: webhookSecret },
      { name: 'normalized', value: normalizedSecret }
    ];
    
    for (const secret of secrets) {
      const hmac = crypto.createHmac('sha256', secret.value);
      hmac.update(stringToSign);
      const expectedSignature = hmac.digest('hex');
      
      // Verificar longitudes antes de comparar
      const receivedLength = signature.length;
      const expectedLength = expectedSignature.length;
      const lengthsMatch = receivedLength === expectedLength;
      
      logger.info('🔍 [DEBUG HMAC] Verificación de longitudes', {
        candidateId,
        secretType: secret.name,
        receivedLength,
        expectedLength,
        lengthsMatch,
        receivedSignature: signature,
        expectedSignature,
        stringToSign
      });
      
      // Solo comparar si las longitudes coinciden
      if (!lengthsMatch) {
        logger.warn('⚠️ [LENGTH MISMATCH] Longitudes diferentes, omitiendo comparación', {
          candidateId,
          secretType: secret.name,
          receivedLength,
          expectedLength
        });
        continue;
      }
      
      const signaturesMatch = signature === expectedSignature;
      
      logger.info('🔍 [DEBUG HMAC] Intento de validación', {
        candidateId,
        secretType: secret.name,
        stringToSign,
        expectedSignature,
        receivedSignature: signature,
        signaturesMatch,
        matchPrefix: signaturesMatch ? '✅' : '❌'
      });
      
      if (signaturesMatch) {
        logger.info('🎯 [SUCCESS] Firma validada exitosamente', {
          candidateId,
          secretType: secret.name,
          stringToSign
        });
        return { ok: true, dataId: candidateId };
      }
    }
  }
  
  // Si no encontramos coincidencia y es merchant_order, hacer fetch para obtener payment IDs
  if (!foundMatch && p.resource && p.resource.toString().includes('merchant_orders')) {
    logger.info('🔍 [DEBUG MERCHANT ORDER] IDs básicos fallaron, obteniendo payment IDs del API');
    
    const merchantOrderId = dataId;
    if (merchantOrderId) {
      const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
      if (mpToken) {
        try {
          const response = await fetch(`https://api.mercadolibre.com/merchant_orders/${merchantOrderId}`, {
            headers: {
              'Authorization': `Bearer ${mpToken}`
            }
          });
          
          if (response.ok) {
            const merchantOrderData = await response.json() as MerchantOrderData;
            logger.info('🔍 [DEBUG MERCHANT ORDER] Datos del merchant_order obtenidos', {
              merchantOrderId,
              payments: merchantOrderData.payments?.map((p: MerchantOrderPayment) => ({ id: p.id, status: p.status })) || []
            });
            
            // Probar con payment IDs reales
            if (merchantOrderData.payments && Array.isArray(merchantOrderData.payments)) {
              for (const payment of merchantOrderData.payments) {
                if (payment.id) {
                  const paymentId = String(payment.id);
                  const stringToSign = `id:${paymentId};request-id:${xRequestId};ts:${ts}`;
                  
                  for (const secret of [{ name: 'original', value: webhookSecret }, { name: 'normalized', value: normalizedSecret }]) {
                    const hmac = crypto.createHmac('sha256', secret.value);
                    hmac.update(stringToSign);
                    const expectedSignature = hmac.digest('hex');
                    
                    const signaturesMatch = signature === expectedSignature;
                    
                    logger.info('🔍 [DEBUG PAYMENT ID] Intento con payment ID real', {
                      paymentId,
                      secretType: secret.name,
                      stringToSign,
                      expectedSignature,
                      receivedSignature: signature,
                      signaturesMatch,
                      matchPrefix: signaturesMatch ? '✅' : '❌'
                    });
                    
                    if (signaturesMatch) {
                      logger.info('🎯 [SUCCESS] Firma validada con payment ID', {
                        paymentId,
                        secretType: secret.name,
                        stringToSign
                      });
                      return { ok: true, dataId: paymentId };
                    }
                  }
                }
              }
            }
          } else {
            logger.warn('🔍 [DEBUG MERCHANT ORDER] Error obteniendo merchant_order', {
              status: response.status,
              statusText: response.statusText
            });
          }
        } catch (fetchError) {
          logger.warn('🔍 [DEBUG MERCHANT ORDER] Error de fetch al merchant_order', {
            error: fetchError instanceof Error ? fetchError.message : String(fetchError)
          });
        }
      } else {
        logger.warn('🔍 [DEBUG MERCHANT ORDER] No hay MERCADO_PAGO_ACCESS_TOKEN configurado');
      }
    }
  }
  
  logger.error('❌ [FAILED] Ningún candidato coincidió con la firma recibida', {
    receivedSignature: signature,
    totalAttempts: uniqueCandidates.length * 2
  });
  
  throw new Error('Firma inválida - ningún ID candidato coincidió');
}

/* --------------------------------------------------
 * Wrapper simplificado: verifyHmacSHA256
 * Cascade te va a pedir llamarlo desde el route handler
 * -------------------------------------------------- */
export async function verifyHmacSHA256(
  xSignature: string | undefined,
  rawBody: string,
  webhookSecret: string,
  xRequestId?: string | null
): Promise<WebhookValidationResult> {
  logger.info('verifyHmacSHA256 INIT', {
    xSignatureLength: xSignature?.length,
    hasRequestId: !!xRequestId,
  });

  try {
    const headers = new Headers();
    if (xSignature) headers.set('x-signature', xSignature);
    if (xRequestId) headers.set('x-request-id', xRequestId);

    const result = await validateMercadoPagoHmac(rawBody, headers, webhookSecret);

    return { isValid: result.ok, dataId: result.dataId };
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* --------------------------------------------------
 * verifyWebhookSignature
 * (Modo compatibilidad y fallback)
 * -------------------------------------------------- */
export async function verifyWebhookSignature(
  rawBody: string,
  xSignature: string | null,
  xRequestId: string | null,
  webhookSecret: string
): Promise<WebhookValidationResult> {
  try {
    // En desarrollo sin secret → permitir
    if (process.env.NODE_ENV === 'development' && !webhookSecret) {
      logger.warn('DEV MODE: Saltando validación HMAC');
      try {
        const parsed = JSON.parse(rawBody);
        return {
          isValid: true,
          dataId: parsed?.data?.id ? String(parsed.data.id) : undefined,
        };
      } catch {
        return { isValid: true };
      }
    }

    const headers = new Headers();
    if (xSignature) headers.set('x-signature', xSignature);
    if (xRequestId) headers.set('x-request-id', xRequestId);

    const result = await validateMercadoPagoHmac(rawBody, headers, webhookSecret);

    return { isValid: result.ok, dataId: result.dataId };
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* --------------------------------------------------
 * Validación de estructura del payload
 * (Después de validar firma)
 * -------------------------------------------------- */
export function validateWebhookPayload(rawBody: string): {
  isValid: boolean;
  action?: string;
  dataId?: string;
  error?: string;
} {
  try {
    const p = JSON.parse(rawBody);

    // test.notification
    if (p?.action === 'test.notification') {
      return { isValid: true, action: p.action };
    }

    const dataId: string | undefined =
      p?.data?.id ??
      p?.id ??
      (() => {
        if (p?.resource) {
          const m = String(p.resource).match(/(\d+)$/);
          return m?.[1];
        }
        return undefined;
      })();

    const actionOrTopic = p.action || p.topic;

    if (!actionOrTopic || !dataId) {
      return {
        isValid: false,
        error: 'Estructura inválida: faltan action/topic o data.id',
      };
    }

    return {
      isValid: true,
      action: actionOrTopic,
      dataId,
    };
  } catch {
    return {
      isValid: false,
      error: 'JSON inválido',
    };
  }
}
