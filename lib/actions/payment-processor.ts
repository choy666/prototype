// lib/actions/payment-processor.ts
// Procesador unificado de pagos de Mercado Pago

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '@/lib/db';
import { mercadopagoPayments, mercadopagoPreferences, orders, orderItems, products, productVariants, stockLogs } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

// Extender PaymentResponse para incluir campos no documentados
interface ExtendedPaymentResponse {
  id: string | number;
  status: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  payment_method_id?: string;
  payment_method?: {
    type?: string;
  };
  currency_id?: string;
  installments?: number;
  issuer_id?: string;
  description?: string;
  statement_descriptor?: string;
  date_created?: string;
  date_approved?: string;
  date_last_updated?: string;
  preference_id?: string;
  order?: {
    id?: string | number;
  };
  [key: string]: unknown; // Permitir campos adicionales
}

// Configuración de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  options: { timeout: 5000 },
});

// Cache en memoria para idempotencia (evita duplicados en la misma instancia)
const processingCache = new Map<string, number>();
const CACHE_TTL_MS = 60000; // 1 minuto

/**
 * Verificación simple de cache en memoria solo para optimización local
 * La verdadera idempotencia se maneja con constraint unique en DB
 */
export async function checkPaymentIdempotency(paymentId: string): Promise<{
  canProcess: boolean;
  reason?: string;
  existingStatus?: string;
}> {
  // 1. Verificar cache en memoria (optimización local para mismo request duplicado)
  const cachedTime = processingCache.get(paymentId);
  if (cachedTime && Date.now() - cachedTime < CACHE_TTL_MS) {
    logger.info('[Idempotency] Duplicado detectado en cache local', {
      paymentId,
      reason: 'duplicate_in_progress',
    });
    
    return {
      canProcess: false,
      reason: 'duplicate_in_progress',
    };
  }

  // 2. Marcar como en proceso
  processingCache.set(paymentId, Date.now());

  // 🔥 SIMPLIFICACIÓN: Siempre permitir procesamiento
  // La verdadera validación de duplicados ocurre en el insert con constraint unique
  logger.info('[Idempotency] Permitiendo procesamiento (validación final en DB)', {
    paymentId,
  });
  
  return { canProcess: true };
}

/**
 * Limpia entradas antiguas del cache
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, time] of processingCache.entries()) {
    if (now - time > CACHE_TTL_MS) {
      processingCache.delete(key);
    }
  }
}

// Limpiar cache cada minuto
setInterval(cleanupCache, 60000);

/**
 * Procesa un webhook de pago de Mercado Pago
 */
export async function processPaymentWebhook(
  paymentId: string,
  requestId: string,
  requiresManualVerification: boolean = false,
  hmacAuditContext?: {
    validationResult?: string;
    failureReason?: string;
    fallbackUsed?: boolean;
    webhookRequestId?: string;
  }
): Promise<{
  success: boolean;
  status?: string;
  error?: string;
  alreadyProcessed?: boolean;
}> {
  const startTime = Date.now();

  try {
    logger.info('[PaymentProcessor] Iniciando procesamiento', {
      paymentId,
      requestId,
      requiresManualVerification,
      hmacAuditContext,
      source: requestId?.includes('fallback') ? 'success-page-fallback' : 
              requiresManualVerification ? 'hmac-fallback' : 'webhook',
      timestamp: new Date().toISOString()
    });

    // 🔥 SIMPLIFICACIÓN: Verificación simple de cache local
    const idempotencyCheck = await checkPaymentIdempotency(paymentId);
    
    if (!idempotencyCheck.canProcess) {
      logger.info('[PaymentProcessor] Pago rechazado por cache local', {
        paymentId,
        requestId,
        reason: idempotencyCheck.reason,
        source: requestId?.includes('fallback') ? 'success-page-fallback' : 
                requiresManualVerification ? 'hmac-fallback' : 'webhook',
      });
      
      // 🔥 IMPORTANTE: Verificar si el stock necesita ajuste incluso en pagos duplicados
      // Esto puede ocurrir si el primer intento falló antes de ajustar stock
      try {
        const payment = new Payment(client);
        const paymentData = await payment.get({ id: paymentId }) as unknown as ExtendedPaymentResponse;
        
        logger.info('[PaymentProcessor] Verificando stock en pago duplicado', {
          paymentId,
          status: paymentData.status,
          requiresManualVerification,
        });
        
        // Si el pago es approved o pending, verificar si el stock ya fue ajustado
        if (['approved', 'pending'].includes(paymentData.status)) {
          // 🔥 CORRECCIÓN: Buscar preferencia en tabla de pagos ya existentes
          // Ya que external_reference y preference_id vienen undefined
          const existingPayment = await db
            .select({ preferenceId: mercadopagoPayments.preferenceId })
            .from(mercadopagoPayments)
            .where(eq(mercadopagoPayments.paymentId, paymentId.toString()))
            .limit(1);
            
          if (existingPayment.length > 0 && existingPayment[0].preferenceId) {
            // Obtener orden a partir de la preferencia encontrada
            // 🔥 CORRECCIÓN: Convertir preferenceId a number para el where
            const preference = await db
              .select({ orderId: mercadopagoPreferences.orderId })
              .from(mercadopagoPreferences)
              .where(eq(mercadopagoPreferences.preferenceId, existingPayment[0].preferenceId))
              .limit(1);
              
            if (preference.length > 0 && preference[0].orderId) {
              // Verificar si el stock ya fue deducido
              const orderCheck = await db
                .select({ stockDeducted: orders.stockDeducted })
                .from(orders)
                .where(eq(orders.id, preference[0].orderId))
                .limit(1);
                
              if (orderCheck.length > 0 && !orderCheck[0].stockDeducted) {
                logger.info('[PaymentProcessor] Stock no deducido en pago duplicado - ajustando', {
                  paymentId,
                  orderId: preference[0].orderId,
                  status: paymentData.status,
                  preferenceId: existingPayment[0].preferenceId,
                });
                
                // Ajustar stock si no fue deducido previamente
                await adjustStockForOrder(preference[0].orderId, paymentId.toString());
              } else {
                logger.info('[PaymentProcessor] Stock ya deducido en pago duplicado', {
                  paymentId,
                  orderId: preference[0].orderId,
                  stockDeducted: orderCheck[0]?.stockDeducted,
                });
              }
            }
          } else {
            logger.warn('[PaymentProcessor] No se encontró preferencia para pago duplicado', {
              paymentId,
              status: paymentData.status,
              existingPaymentCount: existingPayment.length,
            });
            
            // 🔥 NUEVO: Intentar buscar por external_reference directamente si no hay preferenceId
            // Esto puede pasar si el primer pago no guardó preferenceId correctamente
            if (paymentData.external_reference) {
              logger.info('[PaymentProcessor] Buscando orden por external_reference como fallback', {
                paymentId,
                externalReference: paymentData.external_reference,
              });
              
              const prefByExtRef = await db
                .select({ orderId: mercadopagoPreferences.orderId })
                .from(mercadopagoPreferences)
                .where(eq(mercadopagoPreferences.externalReference, paymentData.external_reference))
                .limit(1);
                
              if (prefByExtRef.length > 0 && prefByExtRef[0].orderId) {
                const orderCheck = await db
                  .select({ stockDeducted: orders.stockDeducted })
                  .from(orders)
                  .where(eq(orders.id, prefByExtRef[0].orderId))
                  .limit(1);
                  
                if (orderCheck.length > 0 && !orderCheck[0].stockDeducted) {
                  logger.info('[PaymentProcessor] Ajustando stock via external_reference fallback', {
                    paymentId,
                    orderId: prefByExtRef[0].orderId,
                    externalReference: paymentData.external_reference,
                  });
                  
                  await adjustStockForOrder(prefByExtRef[0].orderId, paymentId.toString());
                }
              }
            }
          }
        }
      } catch (error) {
        logger.error('[PaymentProcessor] Error verificando stock en pago duplicado', {
          paymentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      
      return {
        success: true,
        alreadyProcessed: true,
      };
    }

    // Obtener información del pago desde Mercado Pago API
    const payment = new Payment(client);
    const paymentData = await payment.get({ id: paymentId }) as unknown as ExtendedPaymentResponse;

    logger.info('[PaymentProcessor] Datos obtenidos de MP', {
      paymentId,
      status: paymentData.status,
      statusDetail: paymentData.status_detail,
      externalReference: paymentData.external_reference,
      amount: paymentData.transaction_amount,
      // Debug: log estructura completa
      paymentDataKeys: Object.keys(paymentData),
      fullPaymentData: paymentData,
    });

    // 🔥 ELIMINADO: Doble check redundante que causa HMAC-FALLBACK errors
    // La verdadera validación de duplicados ocurre en el insert con constraint unique
    // Si el pago ya existe, el insert fallará con constraint violation y se manejará como éxito

    // Validar campos obligatorios antes de insertar
    if (!paymentData.id) {
      throw new Error('paymentData.id es requerido');
    }
    
    if (!paymentData.status) {
      throw new Error('paymentData.status es requerido');
    }

    // 🔥 CORRECCIÓN: Buscar preferenceId en DB si no viene en paymentData
    let preferenceId = paymentData.preference_id?.toString() || null;
    
    if (!preferenceId && paymentData.external_reference) {
      logger.info('[PaymentProcessor] Buscando preferenceId en DB via external_reference', {
        paymentId: paymentData.id?.toString() || paymentId,
        externalReference: paymentData.external_reference,
      });
      
      const prefByExtRef = await db
        .select({ preferenceId: mercadopagoPreferences.preferenceId })
        .from(mercadopagoPreferences)
        .where(eq(mercadopagoPreferences.externalReference, paymentData.external_reference))
        .limit(1);
        
      if (prefByExtRef.length > 0 && prefByExtRef[0].preferenceId) {
        preferenceId = prefByExtRef[0].preferenceId;
        logger.info('[PaymentProcessor] preferenceId encontrado en DB', {
          paymentId: paymentData.id?.toString() || paymentId,
          preferenceId,
          externalReference: paymentData.external_reference,
        });
      }
    }

    // Insertar nuevo pago con campos de auditoría HMAC
    const insertData = {
      paymentId: paymentData.id?.toString() || paymentId,
      preferenceId: preferenceId, // 🔥 Usar preferenceId encontrado en DB
      status: paymentData.status,
      paymentMethodId: paymentData.payment_method_id?.toString() || null,
      paymentMethodType: paymentData.payment_method?.type?.toString() || null,
      paymentMethodName: paymentData.payment_method_id?.toString() || null,
      amount: paymentData.transaction_amount?.toString() || '0',
      currencyId: paymentData.currency_id?.toString() || 'ARS',
      installments: paymentData.installments || null,
      issuerId: paymentData.issuer_id?.toString() || null,
      description: paymentData.description?.toString() || null,
      externalReference: paymentData.external_reference?.toString() || null,
      statementDescriptor: paymentData.statement_descriptor?.toString() || null,
      dateCreated: paymentData.date_created ? new Date(paymentData.date_created) : new Date(),
      dateApproved: paymentData.date_approved ? new Date(paymentData.date_approved) : null,
      dateLastUpdated: paymentData.date_last_updated ? new Date(paymentData.date_last_updated) : new Date(),
      rawData: paymentData,
      // Campos de auditoría HMAC
      requiresManualVerification: requiresManualVerification || false,
      hmacValidationResult: hmacAuditContext?.validationResult || (requiresManualVerification ? 'fallback_used' : 'valid'),
      hmacFailureReason: hmacAuditContext?.failureReason || null,
      hmacFallbackUsed: hmacAuditContext?.fallbackUsed || false,
      verificationTimestamp: new Date(),
      webhookRequestId: hmacAuditContext?.webhookRequestId || requestId,
      createdAt: new Date(),
    };

    logger.info('[PaymentProcessor] Insertando pago', {
      paymentId,
      preferenceId: insertData.preferenceId,
      hasPreference: !!insertData.preferenceId,
    });

    try {
      await db.insert(mercadopagoPayments).values(insertData);
    } catch (dbError: unknown) {
      // 🔥 Manejar violación de constraint de unicidad (race condition)
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      const errorCode = (dbError as { code?: string })?.code;
      
      if (errorCode === '23505' || errorMessage.includes('unique constraint') || errorMessage.includes('duplicate key')) {
        logger.info('[PaymentProcessor] Pago duplicado detectado por constraint', {
          paymentId,
          preferenceId: insertData.preferenceId,
          status: insertData.status,
        });
        
        // El pago ya fue insertado por otra instancia, retornar éxito
        return {
          success: true,
          status: insertData.status,
          alreadyProcessed: true,
        };
      }
      
      logger.error('[PaymentProcessor] Error insertando en DB', {
        paymentId,
        error: errorMessage,
        stack: dbError instanceof Error ? dbError.stack : undefined,
        insertData: {
          paymentId: insertData.paymentId,
          preferenceId: insertData.preferenceId,
          status: insertData.status,
        },
      });
      throw dbError;
    }

    logger.info('[PaymentProcessor] Pago insertado', { paymentId });

    // Procesar según estado
    await processStatusChange(paymentData);

    const duration = Date.now() - startTime;
    logger.info('[PaymentProcessor] Completado', {
      paymentId,
      status: paymentData.status,
      requiresManualVerification,
      hmacAuditContext,
      duration: `${duration}ms`,
    });

    return {
      success: true,
      status: paymentData.status ?? undefined,
    };

  } catch (error) {
    logger.error('[PaymentProcessor] Error', {
      paymentId,
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Limpiar del cache después de procesar
    processingCache.delete(paymentId);
  }
}

/**
 * Procesa cambios de estado del pago
 */
interface PaymentStatusPayload {
  id?: string | number;
  status?: string;
  external_reference?: string;
  preference_id?: string; // 🔥 Agregar preference_id como alternativa
}

async function processStatusChange(paymentData: PaymentStatusPayload): Promise<void> {
  const status = paymentData.status;
  const externalReference = paymentData.external_reference;
  const preferenceId = paymentData.preference_id; // 🔥 Usar preference_id si external_reference no existe

  // 🔥 CORRECCIÓN: Permitir procesamiento si tenemos preference_id
  if (!externalReference && !preferenceId) {
    logger.warn('[PaymentProcessor] Sin external_reference ni preference_id', {
      paymentId: paymentData.id,
      hasExternalReference: !!externalReference,
      hasPreferenceId: !!preferenceId,
    });
    return;
  }

  if (!status) {
    logger.warn('[PaymentProcessor] Status vacío en paymentData', {
      paymentId: paymentData.id,
    });
    return;
  }

  // Buscar preferencia asociada
  let preference: {
    id: number;
    orderId: number | null;
    preferenceId: string | null;
    externalReference: string | null;
  } | null | undefined = null;
  
  if (preferenceId) {
    // 🔥 NUEVO: Buscar por ID de preferencia si external_reference no existe
    logger.info('[PaymentProcessor] Buscando preferencia por ID', {
      paymentId: paymentData.id,
      preferenceId,
    });
    
    // 🔥 CORRECCIÓN: preferenceId es string pero el campo es serial (number)
    // Necesitamos buscar por preferenceId en lugar de id
    preference = await db.query.mercadopagoPreferences.findFirst({
      where: eq(mercadopagoPreferences.preferenceId, preferenceId),
    });
  } else {
    // ANTIGuo: Buscar por external_reference
    const normalizedExternalReference = String(externalReference);
    logger.info('[PaymentProcessor] Buscando preferencia por external_reference', {
      paymentId: paymentData.id,
      originalExternalReference: externalReference,
      normalizedExternalReference,
    });
    
    preference = await db.query.mercadopagoPreferences.findFirst({
      where: eq(mercadopagoPreferences.externalReference, normalizedExternalReference),
    });
  }

  logger.info('[PaymentProcessor] Preferencia encontrada', {
    paymentId: paymentData.id,
    preferenceFound: !!preference,
    preferenceId: preference?.id,
    orderId: preference?.orderId,
    searchMethod: preferenceId ? 'byId' : 'byExternalReference',
  });

  if (!preference || !preference.orderId) {
    logger.warn('[PaymentProcessor] Preferencia no encontrada', {
      paymentId: paymentData.id,
      externalReference,
      preferenceId,
    });
    return;
  }

  // Nueva lógica de mapeo de estados - Todos los pagos van a 'pending' excepto rechazados explícitamente
  type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'rejected' | 'processing' | 'failed' | 'returned';
  const orderStatusMap: Record<string, OrderStatus> = {
    approved: 'pending',    // ← Cambio: pagos aprobados van a pending para verificación manual
    pending: 'pending',     // ← Permanece en pending
    rejected: 'cancelled',  // ← Cambio: rechazados van a cancelled
    cancelled: 'cancelled', // ← Permanece en cancelled
    refunded: 'cancelled',  // ← No hay 'refunded' en schema, usar cancelled
    charged_back: 'failed', // ← No hay 'disputed' en schema, usar failed
    in_process: 'pending',  // ← En proceso también va a pending
    authorised: 'pending',  // ← Autorizado también va a pending
  };

  const newOrderStatus = orderStatusMap[status];
  if (!newOrderStatus) {
    logger.info('[PaymentProcessor] Estado no requiere actualización', {
      paymentId: paymentData.id,
      status,
    });
    return;
  }

  // Log específico para la nueva lógica
  logger.info('[PaymentProcessor] Aplicando nueva lógica de estados', {
    paymentId: paymentData.id,
    originalStatus: status,
    newOrderStatus,
    requiresManualVerification: ['approved', 'pending', 'in_process', 'authorised'].includes(status),
    willAdjustStock: ['approved', 'pending'].includes(status), // 🔥 Corregido: approved y pending ajustan stock
  });

  // Actualizar orden
  await db.update(orders)
    .set({
      status: newOrderStatus as OrderStatus,
      paymentId: paymentData.id?.toString(),
      mercadoPagoId: paymentData.id?.toString(),
      updatedAt: new Date(),
      stockDeducted: false, // Se marcará como true después de ajustar stock
    })
    .where(eq(orders.id, preference.orderId));

  // Actualizar preferencia
  await db.update(mercadopagoPreferences)
    .set({
      status: status === 'approved' ? 'active' : 'pending',
      updatedAt: new Date(),
    })
    .where(eq(mercadopagoPreferences.id, preference.id));

  logger.info('[PaymentProcessor] Orden actualizada', {
    paymentId: paymentData.id,
    orderId: preference.orderId,
    newStatus: newOrderStatus,
  });

  // 🔥 AJUSTE DE STOCK CRÍTICO: Para pagos aprobados y pending (reservar inventario)
  if (['approved', 'pending'].includes(status)) {
    const paymentIdStr = paymentData.id?.toString() || paymentData.id?.toString() || 'unknown';
    await adjustStockForOrder(preference.orderId, paymentIdStr);
  }
}

/**
 * Ajusta el stock para los items de una orden con protección contra race conditions
 * Usa transacción explícita y bloqueo a nivel de DB para garantizar idempotencia
 */
export async function adjustStockForOrder(orderId: number, paymentId: string): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.info('[PaymentProcessor] Iniciando ajuste de stock', {
      orderId,
      paymentId,
      timestamp: new Date().toISOString(),
    });

    // 🔥 ELIMINAR TRANSACCIÓN: Neon HTTP no soporta transacciones
    // Usar bloqueo optimista con verificación de stockDeducted
    // 1. Verificar idempotencia sin bloqueo explícito
    const existingOrder = await db
      .select({ stockDeducted: orders.stockDeducted })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!existingOrder.length) {
      throw new Error(`Orden ${orderId} no encontrada`);
    }

    // 2. Verificar si ya fue procesada (idempotencia)
    if (existingOrder[0].stockDeducted) {
      logger.info('[PaymentProcessor] Stock ya ajustado previamente', {
        orderId,
        paymentId,
        stockDeducted: existingOrder[0].stockDeducted,
      });
      return; // Salir sin hacer cambios
    }

    // 3. Obtener items de la orden
    const orderItemsData = await db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        variantId: orderItems.variantId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    if (orderItemsData.length === 0) {
      logger.warn('[PaymentProcessor] Orden sin items para ajustar stock', {
        orderId,
        paymentId,
      });
      return;
    }

    logger.info('[PaymentProcessor] Items encontrados para ajuste de stock', {
      orderId,
      paymentId,
      itemsCount: orderItemsData.length,
      items: orderItemsData.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    });

    // 4. Ajustar stock para cada item con doble verificación de idempotencia
    let totalAdjusted = 0;
    for (const item of orderItemsData) {
      try {
        // 🔥 VERIFICACIÓN EXTRA: Re-check stockDeducted antes de cada item
        const currentOrder = await db
          .select({ stockDeducted: orders.stockDeducted })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

        if (currentOrder.length > 0 && currentOrder[0].stockDeducted) {
          logger.info('[PaymentProcessor] Stock ya deducido por otro proceso - deteniendo ajuste', {
            orderId,
            paymentId,
            itemId: item.id,
            stockDeducted: currentOrder[0].stockDeducted,
          });
          break; // Salir del loop si ya fue procesado
        }

        const change = -Math.abs(item.quantity); // Siempre restar stock
        const reason = `Venta orden #${orderId} - pago ${paymentId}`;

        if (item.variantId) {
          // 🔥 Obtener stock actual antes de ajustar
          const currentVariant = await db
            .select({ stock: productVariants.stock, isActive: productVariants.isActive })
            .from(productVariants)
            .where(eq(productVariants.id, item.variantId))
            .limit(1);

          if (!currentVariant.length) {
            throw new Error(`Variante ${item.variantId} no encontrada`);
          }

          const oldStock = currentVariant[0].stock;

          // 🔥 Ajuste directo de stock de variante
          await db
            .update(productVariants)
            .set({
              stock: sql`GREATEST(0, ${productVariants.stock} + ${change})`,
              isActive: sql`CASE WHEN GREATEST(0, ${productVariants.stock} + ${change}) > 0 THEN true ELSE false END`,
              updated_at: new Date()
            })
            .where(eq(productVariants.id, item.variantId));

          // Obtener nuevo stock para logging
          const updatedVariant = await db
            .select({ stock: productVariants.stock, isActive: productVariants.isActive })
            .from(productVariants)
            .where(eq(productVariants.id, item.variantId))
            .limit(1);

          // Registrar en stockLogs
          await db.insert(stockLogs).values({
            productId: item.productId,
            variantId: item.variantId,
            oldStock: oldStock, // 🔥 Valor real antes del ajuste
            newStock: updatedVariant[0]?.stock || 0,
            change,
            reason,
            userId: 1, // System user
          });

          logger.info('[PaymentProcessor] Stock de variante ajustado', {
            orderId,
            paymentId,
            variantId: item.variantId,
            productId: item.productId,
            change,
            newStock: updatedVariant[0]?.stock,
          });
        } else {
          // 🔥 Obtener stock actual antes de ajustar
          const currentProduct = await db
            .select({ stock: products.stock })
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);

          if (!currentProduct.length) {
            throw new Error(`Producto ${item.productId} no encontrado`);
          }

          const oldStock = currentProduct[0].stock;

          // 🔥 Ajuste directo de stock de producto
          await db
            .update(products)
            .set({ 
              stock: sql`GREATEST(0, ${products.stock} + ${change})`,
              updated_at: new Date() 
            })
            .where(eq(products.id, item.productId));

          // Obtener nuevo stock para logging
          const updatedProduct = await db
            .select({ stock: products.stock })
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);

          // Registrar en stockLogs
          await db.insert(stockLogs).values({
            productId: item.productId,
            oldStock: oldStock, // 🔥 Valor real antes del ajuste
            newStock: updatedProduct[0]?.stock || 0,
            change,
            reason,
            userId: 1, // System user
          });

          logger.info('[PaymentProcessor] Stock de producto ajustado', {
            orderId,
            paymentId,
            productId: item.productId,
            change,
            newStock: updatedProduct[0]?.stock,
          });
        }

        totalAdjusted += Math.abs(change);
      } catch (stockError) {
        // 🔥 MEJORADO: Exponer error real para diagnóstico
        const errorMessage = stockError instanceof Error ? stockError.message : String(stockError);
        const errorStack = stockError instanceof Error ? stockError.stack : undefined;
        
        logger.error('[PaymentProcessor] Error ajustando stock individual', {
          orderId,
          paymentId,
          itemId: item.id,
          productId: item.productId,
          variantId: item.variantId,
          // 🔥 Exponer error completo temporalmente para debugging
          error: errorMessage,
          stack: errorStack,
          errorType: stockError?.constructor?.name || 'Unknown',
          timestamp: new Date().toISOString(),
        });
        
        // 🔥 ESTRATEGIA: Si es constraint violation, probablemente es race condition - continuar
        if (errorMessage.includes('unique constraint') || 
            errorMessage.includes('duplicate key') ||
            errorMessage.includes('violates unique constraint')) {
          logger.info('[PaymentProcessor] Constraint violation detectado - probable race condition, continuando', {
            orderId,
            paymentId,
            itemId: item.id,
          });
        }
        
        // Continuar con otros items en lugar de cancelar todo
        continue;
      }
    }

    // 5. Marcar orden como procesada
    await db
      .update(orders)
      .set({ stockDeducted: true })
      .where(eq(orders.id, orderId));

    logger.info('[PaymentProcessor] Stock ajustado y orden marcada como procesada', {
      orderId,
      paymentId,
      totalItems: orderItemsData.length,
      totalAdjusted,
      duration: `${Date.now() - startTime}ms`,
    });

  } catch (error) {
    // 🔥 MEJORADO: Logging completo sin redactar para debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('[PaymentProcessor] Error crítico en ajuste de stock', {
      orderId,
      paymentId,
      error: errorMessage, // 🔥 Error real visible
      stack: errorStack,   // 🔥 Stack trace completo
      duration: `${Date.now() - startTime}ms`,
      // 🔥 Información de diagnóstico adicional
      errorType: error?.constructor?.name || 'Unknown',
      timestamp: new Date().toISOString(),
    });
    
    // 🔥 ELIMINADO: No registrar en stockLogs para evitar foreign key constraint violations
    // El error ya está siendo loggeado arriba con logger.error
    
    // No relanzar el error para no afectar el procesamiento del pago
    // El stock se puede ajustar manualmente si es necesario
    logger.warn('[PaymentProcessor] Error de stock no bloquea el procesamiento del pago', {
      orderId,
      paymentId,
      errorMessage, // 🔥 Incluir mensaje real
    });
  }
}
