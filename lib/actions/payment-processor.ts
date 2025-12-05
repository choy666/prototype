// lib/actions/payment-processor.ts
// Procesador unificado de pagos de Mercado Pago

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '@/lib/db';
import { mercadopagoPayments, mercadopagoPreferences, orders } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

// Configuración de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  options: { timeout: 5000 },
});

// Cache en memoria para idempotencia (evita duplicados en la misma instancia)
const processingCache = new Map<string, number>();
const CACHE_TTL_MS = 60000; // 1 minuto

/**
 * Verifica si un pago ya está siendo procesado o fue procesado recientemente
 * Retorna true si es seguro procesar, false si es duplicado
 */
export async function checkPaymentIdempotency(paymentId: string): Promise<{
  canProcess: boolean;
  reason?: string;
  existingStatus?: string;
}> {
  // 1. Verificar cache en memoria (mismo request duplicado)
  const cachedTime = processingCache.get(paymentId);
  if (cachedTime && Date.now() - cachedTime < CACHE_TTL_MS) {
    return {
      canProcess: false,
      reason: 'duplicate_in_progress',
    };
  }

  // 2. Marcar como en proceso
  processingCache.set(paymentId, Date.now());

  // 3. Verificar en base de datos
  try {
    const existingPayment = await db.query.mercadopagoPayments.findFirst({
      where: eq(mercadopagoPayments.paymentId, paymentId),
      columns: {
        id: true,
        status: true,
        dateLastUpdated: true,
      },
    });

    if (existingPayment) {
      return {
        canProcess: false,
        reason: 'already_processed',
        existingStatus: existingPayment.status ?? undefined,
      };
    }

    return { canProcess: true };
  } catch (error) {
    // En caso de error de DB, permitir procesamiento
    logger.warn('[Idempotency] Error verificando DB, permitiendo proceso', {
      paymentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { canProcess: true };
  }
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

    // Obtener información del pago desde Mercado Pago API
    const payment = new Payment(client);
    const paymentData = await payment.get({ id: paymentId });

    logger.info('[PaymentProcessor] Datos obtenidos de MP', {
      paymentId,
      status: paymentData.status,
      statusDetail: paymentData.status_detail,
      externalReference: paymentData.external_reference,
      amount: paymentData.transaction_amount,
    });

    // Verificar nuevamente si ya existe (doble check después de fetch)
    const existingPayment = await db.query.mercadopagoPayments.findFirst({
      where: eq(mercadopagoPayments.paymentId, paymentId),
    });

    if (existingPayment) {
      // Si existe pero cambió el estado, actualizar
      if (existingPayment.status !== paymentData.status) {
        await db.update(mercadopagoPayments)
          .set({
            status: paymentData.status,
            dateLastUpdated: new Date(paymentData.date_last_updated || new Date().toISOString()),
            rawData: paymentData,
            // Mantener campos de auditoría existentes o actualizar si es necesario
            requiresManualVerification: existingPayment.requiresManualVerification || false,
            hmacValidationResult: existingPayment.hmacValidationResult || 'valid',
            hmacFailureReason: existingPayment.hmacFailureReason,
            hmacFallbackUsed: existingPayment.hmacFallbackUsed || false,
            verificationTimestamp: existingPayment.verificationTimestamp,
            webhookRequestId: existingPayment.webhookRequestId,
          })
          .where(eq(mercadopagoPayments.paymentId, paymentId));

        logger.info('[PaymentProcessor] Estado actualizado', {
          paymentId,
          oldStatus: existingPayment.status,
          newStatus: paymentData.status,
        });

        // Procesar cambio de estado
        await processStatusChange(paymentData);
      }

      return {
        success: true,
        status: paymentData.status ?? undefined,
        alreadyProcessed: true,
      };
    }

    // Insertar nuevo pago con campos de auditoría HMAC
    const insertData = {
      paymentId: paymentData.id?.toString() || paymentId,
      preferenceId: paymentData.order?.id?.toString() || null,
      status: paymentData.status,
      paymentMethodId: paymentData.payment_method_id,
      paymentMethodType: paymentData.payment_method?.type || null,
      paymentMethodName: paymentData.payment_method_id,
      amount: paymentData.transaction_amount?.toString() || '0',
      currencyId: paymentData.currency_id,
      installments: paymentData.installments,
      issuerId: paymentData.issuer_id,
      description: paymentData.description,
      externalReference: paymentData.external_reference,
      statementDescriptor: paymentData.statement_descriptor,
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

    await db.insert(mercadopagoPayments).values(insertData);

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
}

async function processStatusChange(paymentData: PaymentStatusPayload): Promise<void> {
  const status = paymentData.status;
  const externalReference = paymentData.external_reference;

  if (!externalReference) {
    logger.warn('[PaymentProcessor] Sin external_reference', {
      paymentId: paymentData.id,
    });
    return;
  }

  if (!status) {
    logger.warn('[PaymentProcessor] Status vacío en paymentData', {
      paymentId: paymentData.id,
    });
    return;
  }

  // Buscar preferencia asociada (convertir a string para normalizar)
  const normalizedExternalReference = String(externalReference);
  logger.info('[PaymentProcessor] Buscando preferencia', {
    paymentId: paymentData.id,
    originalExternalReference: externalReference,
    normalizedExternalReference,
  });
  
  const preference = await db.query.mercadopagoPreferences.findFirst({
    where: eq(mercadopagoPreferences.externalReference, normalizedExternalReference),
  });

  logger.info('[PaymentProcessor] Preferencia encontrada', {
    paymentId: paymentData.id,
    preferenceFound: !!preference,
    preferenceId: preference?.id,
    orderId: preference?.orderId,
  });

  if (!preference || !preference.orderId) {
    logger.warn('[PaymentProcessor] Preferencia no encontrada', {
      paymentId: paymentData.id,
      externalReference,
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
  });

  // Actualizar orden
  await db.update(orders)
    .set({
      status: newOrderStatus as OrderStatus,
      paymentId: paymentData.id?.toString(),
      mercadoPagoId: paymentData.id?.toString(),
      updatedAt: new Date(),
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
}
