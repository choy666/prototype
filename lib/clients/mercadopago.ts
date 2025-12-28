/**
 * Cliente API de Mercado Pago - Singleton Pattern
 * Centraliza todas las llamadas a la API de MP con configuración dinámica
 */

import {
  getMercadoPagoConfig,
  getApiUrl,
  validateConfig,
  PAGINATION,
} from '@/lib/config/integrations';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { logger } from '@/lib/utils/logger';

interface MPPreference {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  items: unknown[];
  payer?: unknown;
  payment_methods?: unknown;
  expires?: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
  notification_url?: string;
}

interface MPPayment {
  id: number;
  status: string;
  status_detail: string;
  payment_method_id: string;
  payment_type_id: string;
  transaction_amount: number;
  currency_id: string;
  description: string;
  installments: number;
  issuer_id?: number;
  date_created: string;
  date_approved?: string;
  last_modified: string;
  payer: {
    id: number;
    email: string;
    identification: {
      type: string;
      number: string;
    };
  };
  external_reference: string;
  order?: {
    id: number;
  };
  fee_details: unknown[];
  collector_id: number;
  campaign_id?: number;
  coupon_amount?: number;
  differential_pricing_id?: number;
  application_fee?: number;
  taxes?: unknown[];
  counter_currency?: string;
  shipping_amount?: number;
  additional_info?: unknown;
  deduction_schema?: unknown;
  metadata: Record<string, unknown>;
}

class MercadoPagoClient {
  private static instance: MercadoPagoClient | null = null;
  private sdk: Preference;
  private config = getMercadoPagoConfig();
  private isConfigured: boolean = false;

  private constructor() {
    // Validar configuración solo si estamos en un entorno que la requiere
    try {
      const validation = validateConfig();
      this.isConfigured = validation.isValid;
      if (!validation.isValid) {
        logger.warn('MercadoPago client not properly configured', {
          errors: validation.errors,
        });
      }
    } catch (error) {
      logger.warn('Failed to validate MercadoPago configuration', { error });
      this.isConfigured = false;
    }

    // Inicializar SDK solo si está configurado
    if (this.isConfigured) {
      const mpConfig = new MercadoPagoConfig({
        accessToken: this.config.accessToken!,
        options: {
          timeout: this.config.timeout,
        },
      });
      this.sdk = new Preference(mpConfig);
    } else {
      // SDK dummy para evitar errores
      this.sdk = {} as Preference;
    }
  }

  static getInstance(): MercadoPagoClient {
    if (!MercadoPagoClient.instance) {
      MercadoPagoClient.instance = new MercadoPagoClient();
    }
    return MercadoPagoClient.instance;
  }

  /**
   * Verificar si el cliente está configurado correctamente
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Obtener instancia solo si está configurada
   */
  static tryGetInstance(): MercadoPagoClient | null {
    const instance = MercadoPagoClient.getInstance();
    return instance.isReady() ? instance : null;
  }

  /**
   * Crear una preferencia de pago usando el SDK oficial
   */
  async createPreference(data: {
    items: unknown[];
    payer?: unknown;
    payment_methods?: unknown;
    shipments?: unknown;
    back_urls?: {
      success?: string;
      failure?: string;
      pending?: string;
    };
    auto_return?: string;
    notification_url?: string;
    expires?: boolean;
    expiration_date_from?: string;
    expiration_date_to?: string;
    statement_descriptor?: string;
    external_reference?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MPPreference> {
    try {
      // Configurar URLs por defecto si no se proporcionan
      const preferenceData = {
        ...data,
        back_urls: data.back_urls || {
          success: this.config.successUrl,
          failure: this.config.failureUrl,
          pending: this.config.pendingUrl,
        },
        notification_url: data.notification_url || this.config.notificationUrl,
        statement_descriptor: data.statement_descriptor || this.config.statementDescriptor,
        auto_return: data.auto_return || 'approved',
        external_reference: data.external_reference,
        metadata: data.metadata || {},
      };

      // Crear preferencia usando el SDK de Mercado Pago
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const preference = await this.sdk.create({ body: preferenceData as any });

      logger.info('MP preference created successfully', {
        preferenceId: preference.id,
        externalReference: data.external_reference,
        itemsCount: data.items.length,
      });

      return preference as MPPreference;
    } catch (error) {
      logger.error('Error creating MP preference', { error });
      throw error;
    }
  }

  /**
   * Obtener una preferencia existente
   */
  async getPreference(preferenceId: string): Promise<MPPreference> {
    try {
      const preference = await this.sdk.get({ preferenceId });
      return preference as MPPreference;
    } catch (error) {
      logger.error('Error getting MP preference', { preferenceId, error });
      throw error;
    }
  }

  /**
   * Actualizar una preferencia existente
   */
  async updatePreference(preferenceId: string, data: Partial<MPPreference>): Promise<MPPreference> {
    try {
      // El SDK de Mercado Pago no tiene método update directo
      // Hay que crear una nueva preferencia o usar la API directamente
      logger.info('MP preference update requested', {
        preferenceId,
        updatedFields: Object.keys(data),
      });

      // Por ahora, retornamos la preferencia existente
      // TODO: Implementar actualización real si es necesario
      const preference = await this.getPreference(preferenceId);
      return preference;
    } catch (error) {
      logger.error('Error updating MP preference', { preferenceId, error });
      throw error;
    }
  }

  /**
   * Buscar pagos con filtros
   */
  async searchPayments(params: {
    external_reference?: string;
    payment_method_id?: string;
    payment_type?: string;
    status?: string;
    date_created?: {
      from?: string;
      to?: string;
    };
    limit?: number;
    offset?: number;
  }): Promise<{
    results: MPPayment[];
    paging: {
      total: number;
      limit: number;
      offset: number;
    };
  }> {
    const url = getApiUrl('mercadopago', '/v1/payments/search');

    // Construir query parameters
    const searchParams = new URLSearchParams();

    if (params.external_reference) {
      searchParams.append('external_reference', params.external_reference);
    }
    if (params.payment_method_id) {
      searchParams.append('payment_method_id', params.payment_method_id);
    }
    if (params.payment_type) {
      searchParams.append('payment_type', params.payment_type);
    }
    if (params.status) {
      searchParams.append('status', params.status);
    }
    if (params.date_created?.from) {
      searchParams.append('range', 'date_created');
      searchParams.append('begin_date', params.date_created.from);
      searchParams.append('end_date', params.date_created.to || new Date().toISOString());
    }
    searchParams.append('limit', (params.limit || PAGINATION.defaultLimit).toString());
    searchParams.append('offset', (params.offset || PAGINATION.defaultOffset).toString());

    try {
      const response = await fetch(`${url}?${searchParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MP API Error ${response.status}: ${error}`);
      }

      const data = await response.json();

      logger.info('MP payments search completed', {
        total: data.paging.total,
        limit: data.paging.limit,
        offset: data.paging.offset,
      });

      return data;
    } catch (error) {
      logger.error('Error searching MP payments', { params, error });
      throw error;
    }
  }

  /**
   * Obtener detalles de un pago
   */
  async getPayment(paymentId: number): Promise<MPPayment> {
    const url = getApiUrl('mercadopago', '/v1/payments/{payment_id}', {
      payment_id: paymentId.toString(),
    });

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MP API Error ${response.status}: ${error}`);
      }

      return response.json();
    } catch (error) {
      logger.error('Error getting MP payment', { paymentId, error });
      throw error;
    }
  }

  /**
   * Crear un cliente
   */
  async createCustomer(data: {
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: {
      area_code: string;
      number: string;
    };
    identification?: {
      type: string;
      number: string;
    };
    default_address?: {
      zip_code: string;
      street_name: string;
      street_number: number;
    };
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    const url = getApiUrl('mercadopago', '/v1/customers');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MP API Error ${response.status}: ${error}`);
      }

      const customer = await response.json();

      logger.info('MP customer created successfully', {
        customerId: customer.id,
        email: customer.email,
      });

      return customer;
    } catch (error) {
      logger.error('Error creating MP customer', { data, error });
      throw error;
    }
  }

  /**
   * Obtener un cliente por email
   */
  async getCustomerByEmail(email: string) {
    const url = getApiUrl('mercadopago', '/v1/customers/search');
    const params = new URLSearchParams({ email });

    try {
      const response = await fetch(`${url}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MP API Error ${response.status}: ${error}`);
      }

      const data = await response.json();
      return data.results?.[0] || null;
    } catch (error) {
      logger.error('Error getting MP customer by email', { email, error });
      throw error;
    }
  }

  /**
   * Obtener métodos de pago disponibles
   */
  async getPaymentMethods(params?: {
    marketplace?: string;
    customer_id?: string;
    payment_type_id?: string;
    payment_method_id?: string;
    card_token_id?: string;
  }) {
    const url = getApiUrl('mercadopago', '/v1/payment_methods');

    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) searchParams.append(key, value);
      });
    }

    try {
      const response = await fetch(`${url}?${searchParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MP API Error ${response.status}: ${error}`);
      }

      return response.json();
    } catch (error) {
      logger.error('Error getting MP payment methods', { params, error });
      throw error;
    }
  }

  /**
   * Verificar webhook de Mercado Pago
   */
  async verifyWebhookSignature(
    xRequestId: string,
    xSignature: string,
    dataId: string
  ): Promise<boolean> {
    try {
      const crypto = await import('node:crypto');

      const manifest = `id:${dataId};request-id:${xRequestId}`;
      const hmac = crypto
        .createHmac('sha256', this.config.webhookSecret!)
        .update(manifest)
        .digest('hex');

      const receivedSignature = xSignature.replace('sha256=', '');

      const isValid = hmac === receivedSignature;

      logger.info('Webhook signature verified', {
        isValid,
        requestId: xRequestId,
        dataId,
      });

      return isValid;
    } catch (error) {
      logger.error('Error verifying webhook signature', {
        error: error instanceof Error ? error.message : String(error),
        requestId: xRequestId,
        dataId,
      });
      return false;
    }
  }

  /**
   * Refund payment (total o parcial)
   */
  async refundPayment(paymentId: number, amount?: number) {
    const url = getApiUrl('mercadopago', '/v1/payments/{payment_id}/refunds', {
      payment_id: paymentId.toString(),
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: amount ? JSON.stringify({ amount }) : undefined,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MP API Error ${response.status}: ${error}`);
      }

      const refund = await response.json();

      logger.info('MP refund processed successfully', {
        paymentId,
        amount,
        refundId: refund.id,
      });

      return refund;
    } catch (error) {
      logger.error('Error processing MP refund', { paymentId, amount, error });
      throw error;
    }
  }
}

// Exportar la instancia singleton
export const mpClient = MercadoPagoClient.getInstance();
export default mpClient;
