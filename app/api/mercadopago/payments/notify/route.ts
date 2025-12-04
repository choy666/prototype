import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '@/lib/db';
import { mercadopagoPayments, mercadopagoPreferences, orders } from '@/lib/schema';
import { eq, and, count } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

interface MercadoPagoNotificationPayload {
  type: 'payment' | 'merchant_order';
  data: {
    id: string;
  };
  action?: string;
  api_version?: string;
  date_created: string;
  id: number;
  live_mode: boolean;
  user_id: number;
}

interface PaymentData {
  id: string;
  status: string;
  status_detail: string;
  payment_method_id: string;
  payment_method_type: string;
  payment_method_name?: string;
  payment_method?: {
    name?: string;
  };
  amount: number;
  currency_id: string;
  installments: number;
  issuer_id?: string;
  description?: string;
  external_reference: string;
  statement_descriptor?: string;
  date_created: string;
  date_approved?: string;
  date_last_updated: string;
  payer: {
    id: number;
    email: string;
    identification: {
      type: string;
      number: string;
    };
    first_name: string;
    last_name: string;
  };
  metadata?: Record<string, unknown>;
  order?: {
    id: number;
    type: string;
  };
  fee_details: Array<{
    type: string;
    amount: number;
    fee_payer?: string;
  }>;
  transaction_amount: number;
  transaction_amount_refunded: number;
  coupon_amount?: number;
  differential_pricing?: Record<string, unknown>;
  deduction_schema?: Record<string, unknown>;
  taxes?: Array<{
    type: string;
    value: number;
  }>;
  binary_mode: boolean;
  payment_type: string;
  payment_type_id: string;
  processing_mode: string;
  merchant_account_id?: number;
  merchant_number?: string;
  acquirer: string;
  acquirer_reconciliation?: Record<string, unknown>;
  additional_info?: Record<string, unknown>;
  callback_url?: string;
  date_of_expiration?: string;
  payment_method_option_id?: string;
  money_release_schema?: string;
  money_release_date?: string;
  money_release_status?: string;
  authorization_code?: string;
  capture: boolean;
  capture_delay?: string;
  card?: {
    id: string;
    first_six_digits: string;
    last_four_digits: string;
    expiration_month: number;
    expiration_year: number;
    cardholder: {
      name: string;
      identification: {
        type: string;
        number: string;
      };
    };
  };
  token?: string;
  esc?: string;
  three_ds_info?: Record<string, unknown>;
  call_for_authorize_id?: string;
  pos_id?: string;
  transaction_details: {
    external_resource_url?: string;
    installment_amount?: number;
    financial_institution?: string;
    payment_method_reference_id?: string;
    net_received_amount?: number;
    total_paid_amount?: number;
    overpaid_amount?: number;
    payable_amount?: number;
    acquirer_reference?: string;
  };
  counter_currency?: string;
  shipping_amount?: number;
  taxes_amount?: number;
}

// Configuración de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  options: { timeout: 5000 },
});

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.text();
    const payload: MercadoPagoNotificationPayload = JSON.parse(body);

    logger.info('Notificación de Mercado Pago recibida', {
      type: payload.type,
      dataId: payload.data.id,
      action: payload.action,
      userId: payload.user_id,
      liveMode: payload.live_mode,
    });

    // Validar que sea una notificación de pago
    if (payload.type !== 'payment') {
      logger.info('Notificación no es de pago, ignorando', { type: payload.type });
      return NextResponse.json({ received: true });
    }

    const paymentId = payload.data.id;

    // Obtener información del pago desde Mercado Pago
    const payment = new Payment(client);
    const paymentData = await payment.get({ id: paymentId });

    logger.info('Datos del pago obtenidos', {
      paymentId,
      status: paymentData.status,
      statusDetail: paymentData.status_detail,
      externalReference: paymentData.external_reference,
      amount: paymentData.transaction_amount,
    });

    // DEBUG: Log completo para diagnóstico
    logger.info('[DEBUG] PaymentData completo', {
      paymentId,
      paymentData: JSON.stringify(paymentData, null, 2),
      paymentDataKeys: Object.keys(paymentData),
      hasOrder: !!paymentData.order,
      hasMetadata: !!paymentData.metadata,
      externalReference: paymentData.external_reference,
    });

    // Verificar si el pago ya fue procesado
    const existingPayment = await db.query.mercadopagoPayments.findFirst({
      where: eq(mercadopagoPayments.paymentId, paymentId),
    });

    logger.info('[DEBUG] Verificación de pago existente', {
      paymentId,
      existingPayment: !!existingPayment,
      existingPaymentId: existingPayment?.id,
    });

    if (existingPayment) {
      logger.info('Pago ya fue procesado anteriormente', {
        paymentId,
        existingStatus: existingPayment.status,
      });

      // Actualizar si el estado cambió
      if (existingPayment.status !== paymentData.status) {
        await db.update(mercadopagoPayments)
          .set({
            status: paymentData.status,
            dateLastUpdated: new Date(paymentData.date_last_updated || new Date().toISOString()),
            rawData: paymentData,
          })
          .where(eq(mercadopagoPayments.paymentId, paymentId));

        logger.info('Estado del pago actualizado', {
          paymentId,
          oldStatus: existingPayment.status,
          newStatus: paymentData.status,
        });
      }

      return NextResponse.json({ 
        received: true,
        alreadyProcessed: true,
      });
    }

    // DEBUG: Log antes de insertar
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
      createdAt: new Date(),
    };

    logger.info('[DEBUG] Datos a insertar', {
      insertDataKeys: Object.keys(insertData),
      paymentId: insertData.paymentId,
      status: insertData.status,
      externalReference: insertData.externalReference,
      hasRawData: !!insertData.rawData,
    });

    // Guardar información del pago
    await db.insert(mercadopagoPayments).values(insertData).returning();

    logger.info('[DEBUG] Pago insertado exitosamente', { paymentId });

    // Procesar el pago según su estado
    logger.info('[DEBUG] Iniciando processPayment', {
      paymentId,
      status: paymentData.status,
      externalReference: paymentData.external_reference,
    });

    await processPayment(paymentData as unknown as PaymentData);

    logger.info('[DEBUG] processPayment completado', { paymentId });

    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.info('Notificación de Mercado Pago procesada', {
      paymentId,
      status: paymentData.status,
      duration: `${duration}ms`,
    });

    return NextResponse.json({ 
      received: true,
      processed: true,
      paymentId,
      status: paymentData.status,
    });

  } catch (error) {
    logger.error('Error procesando notificación de Mercado Pago', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('paymentId');
    const preferenceId = searchParams.get('preferenceId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (paymentId) {
      // Obtener pago específico
      const payment = await db.query.mercadopagoPayments.findFirst({
        where: eq(mercadopagoPayments.paymentId, paymentId),
        with: {
          order: true,
          preference: true,
        },
      });

      if (!payment) {
        return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
      }

      return NextResponse.json(payment);
    } else {
      // Obtener pagos con filtros
      const whereConditions = [];
      
      if (preferenceId) {
        whereConditions.push(eq(mercadopagoPayments.preferenceId, preferenceId));
      }
      
      if (status) {
        whereConditions.push(eq(mercadopagoPayments.status, status));
      }

      const whereCondition = whereConditions.length > 0 
        ? whereConditions.length === 1 
          ? whereConditions[0]
          : and(...whereConditions)
        : undefined;

      const payments = await db.query.mercadopagoPayments.findMany({
        where: whereCondition,
        with: {
          order: {
            columns: {
              id: true,
              total: true,
              status: true,
              createdAt: true,
            },
          },
          preference: {
            columns: {
              id: true,
              preferenceId: true,
              externalReference: true,
              status: true,
            },
          },
        },
        limit,
        offset,
        orderBy: (mercadopagoPayments, { desc }) => [
          desc(mercadopagoPayments.dateCreated),
        ],
      });

      // Obtener estadísticas
      const stats = await db
        .select({
          status: mercadopagoPayments.status,
          count: count(mercadopagoPayments.id),
        })
        .from(mercadopagoPayments)
        .groupBy(mercadopagoPayments.status);

      return NextResponse.json({
        payments,
        stats,
        pagination: {
          limit,
          offset,
          total: payments.length,
        },
      });
    }

  } catch (error) {
    logger.error('Error obteniendo pagos', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función para procesar el pago según su estado
async function processPayment(paymentData: PaymentData): Promise<void> {
  try {
    switch (paymentData.status) {
      case 'approved':
        await handleApprovedPayment(paymentData);
        break;
      
      case 'pending':
        await handlePendingPayment(paymentData);
        break;
      
      case 'rejected':
        await handleRejectedPayment(paymentData);
        break;
      
      case 'cancelled':
        await handleCancelledPayment(paymentData);
        break;
      
      case 'refunded':
        await handleRefundedPayment(paymentData);
        break;
      
      case 'charged_back':
        await handleChargedBackPayment(paymentData);
        break;
      
      default:
        logger.info('Estado de pago no requiere procesamiento especial', {
          paymentId: paymentData.id,
          status: paymentData.status,
        });
    }
  } catch (error) {
    logger.error('Error procesando pago', {
      paymentId: paymentData.id,
      status: paymentData.status,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Handlers específicos por estado
async function handleApprovedPayment(paymentData: PaymentData): Promise<void> {
  logger.info('Procesando pago aprobado', {
    paymentId: paymentData.id,
    externalReference: paymentData.external_reference,
  });

  // Buscar preferencia asociada
  const preference = await db.query.mercadopagoPreferences.findFirst({
    where: eq(mercadopagoPreferences.externalReference, paymentData.external_reference),
  });

  if (preference && preference.orderId) {
    // Actualizar estado de la orden
    await db.update(orders)
      .set({
        status: 'paid',
        paymentId: paymentData.id,
        mercadoPagoId: paymentData.id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, preference.orderId));

    logger.info('Orden actualizada a pagada', {
      paymentId: paymentData.id,
      orderId: preference.orderId,
    });
  }

  // Actualizar preferencia
  if (preference) {
    await db.update(mercadopagoPreferences)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(mercadopagoPreferences.id, preference.id));
  }
}

async function handlePendingPayment(paymentData: PaymentData): Promise<void> {
  logger.info('Procesando pago pendiente', {
    paymentId: paymentData.id,
    statusDetail: paymentData.status_detail,
  });

  // Los pagos pendientes no requieren acción inmediata
  // Solo registramos el estado
}

async function handleRejectedPayment(paymentData: PaymentData): Promise<void> {
  logger.info('Procesando pago rechazado', {
    paymentId: paymentData.id,
    statusDetail: paymentData.status_detail,
  });

  // Buscar preferencia asociada
  const preference = await db.query.mercadopagoPreferences.findFirst({
    where: eq(mercadopagoPreferences.externalReference, paymentData.external_reference),
  });

  if (preference && preference.orderId) {
    // Actualizar estado de la orden a rechazado
    await db.update(orders)
      .set({
        status: 'rejected',
        paymentId: paymentData.id,
        mercadoPagoId: paymentData.id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, preference.orderId));

    logger.info('Orden actualizada a rechazada', {
      paymentId: paymentData.id,
      orderId: preference.orderId,
    });
  }
}

async function handleCancelledPayment(paymentData: PaymentData): Promise<void> {
  logger.info('Procesando pago cancelado', {
    paymentId: paymentData.id,
  });

  // Similar a rechazado pero por cancelación explícita
  const preference = await db.query.mercadopagoPreferences.findFirst({
    where: eq(mercadopagoPreferences.externalReference, paymentData.external_reference),
  });

  if (preference && preference.orderId) {
    await db.update(orders)
      .set({
        status: 'cancelled',
        paymentId: paymentData.id,
        mercadoPagoId: paymentData.id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, preference.orderId));
  }
}

async function handleRefundedPayment(paymentData: PaymentData): Promise<void> {
  logger.info('Procesando pago reembolsado', {
    paymentId: paymentData.id,
  });

  // Aquí podrías implementar lógica de reembolso
  // como devolver stock, enviar notificaciones, etc.
}

async function handleChargedBackPayment(paymentData: PaymentData): Promise<void> {
  logger.info('Procesando contracargo', {
    paymentId: paymentData.id,
  });

  // Los contracargos requieren atención especial
  // podrías enviar alertas al administrador, etc.
}
