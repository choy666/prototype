// Tipos esenciales para Mercado Pago Checkout Pro - Versión limpia

export interface MercadoPagoPreference {
  id: string;
  external_reference: string;
  init_point: string;
  items: PreferenceItem[];
  payer?: Payer;
  payment_methods?: PaymentMethods;
  back_urls?: BackUrls;
  auto_return?: 'approved' | 'pending';
  notification_url?: string;
  expires?: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
  date_created: string;
  last_modified: string;
  shipments?: Shipments;
  metadata?: Record<string, any>;
}

export interface PreferenceItem {
  id: string;
  title: string;
  description?: string;
  picture_url?: string;
  category_id?: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
  unit_measure?: string;
  total_amount?: number;
}

export interface Payer {
  name?: string;
  surname?: string;
  email?: string;
  phone?: {
    area_code?: string;
    number?: string;
    extension?: string;
  };
  identification?: {
    type?: string;
    number?: string;
  };
  address?: {
    street_name?: string;
    street_number?: string;
    zip_code?: string;
    apartment?: string;
    floor?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface PaymentMethods {
  excluded_payment_methods?: Array<{
    id: string;
  }>;
  excluded_payment_types?: Array<{
    id: string;
  }>;
  default_payment_method_id?: string;
  default_installments?: number;
  installments?: number;
  max_installments?: number;
  min_installments?: number;
  max_allowed_amount?: number;
  min_allowed_amount?: number;
}

export interface BackUrls {
  success?: string;
  pending?: string;
  failure?: string;
}

export interface Shipments {
  receiver_address?: ReceiverAddress;
  mode?: 'me1' | 'me2' | 'custom';
  local_pickup?: boolean;
  free_methods?: Array<{
    id: number;
  }>;
  cost?: number;
  free_shipping?: boolean;
  default_shipping_method?: number;
  dimensions?: string;
  default_carrier?: string;
}

export interface ReceiverAddress {
  zip_code?: string;
  street_name?: string;
  street_number?: string;
  floor?: string;
  apartment?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface MercadoPagoPayment {
  id: string;
  date_created: string;
  date_approved?: string;
  date_last_updated: string;
  money_release_date?: string;
  money_release_schema?: string;
  operation_type: string;
  issuer_id?: string;
  payment_method_id: string;
  payment_method_type: string;
  payment_method?: {
    id: string;
    name: string;
    payment_type_id: string;
    financial_institution?: string;
    debit_card?: boolean;
    credit_card?: boolean;
    prepaid_card?: boolean;
    description?: string;
    secure_thumbnail?: string;
    thumbnail?: string;
    processing_modes?: Array<string>;
    settings?: Array<{
      bin?: {
        pattern?: string;
        exclusion_pattern?: string;
        installments_pattern?: string;
      };
      card_number?: {
        length?: number;
        security_code?: {
          length?: number;
          card_location?: string;
        };
      };
    }>;
  };
  status: string;
  status_detail: string;
  currency_id: string;
  transaction_amount: number;
  transaction_amount_refunded?: number;
  coupon_amount?: number;
  differential_pricing?: any;
  deduction_schema?: any;
  transaction_details: TransactionDetails;
  fee_details?: Array<{
    type: string;
    amount: number;
    fee_payer?: string;
  }>;
  taxes?: Array<{
    type?: string;
    value?: number;
  }>;
  counter_currency?: string;
  shipping_amount?: number;
  total_paid_amount: number;
  installments: number;
  card?: Card;
  statement_descriptor?: string;
  alive?: boolean;
  binary_mode: boolean;
  call_for_authorize_id?: string;
  coupon_code?: string;
  description?: string;
  external_reference?: string;
  integrator_id?: string;
  marketplace?: string;
  merchant_account_id?: number;
  merchant_number?: string;
  metadata?: Record<string, any>;
  notification_url?: string;
  order?: {
    id: number;
    type: string;
  };
  additional_info?: AdditionalInfo;
  callback_url?: string;
  date_of_expiration?: string;
  expiration_date?: string;
  differential_pricing_id?: number;
  brand_id?: number;
  pos_id?: string;
  processing_mode?: string;
  merchant_services?: any;
  acquirer?: string;
  acquirer_reconciliation?: any;
  payment_type?: string;
  payment_type_id?: string;
  capture?: boolean;
  captured?: boolean;
  live_mode?: boolean;
  refund_reason?: string;
  refunds?: Array<any>;
  shipping_cost?: number;
  taxes_amount?: number;
  application_fee?: number;
  platform_fee?: number;
  reason?: string;
  payer: PayerInfo;
  collector_id: number;
  collector?: {
    id: number;
    email: string;
    nickname: string;
    first_name: string;
    last_name: string;
    phone?: {
      area_code?: string;
      number?: string;
      extension?: string;
    };
    address?: {
      street_name?: string;
      street_number?: string;
      zip_code?: string;
    };
    country_id?: string;
  };
  marketplace_owner?: number;
  sponsor_id?: number;
  authorization_code?: string;
  three_ds_info?: ThreeDSInfo;
  point_of_interaction?: PointOfInteraction;
  net_received_amount?: number;
  overpaid_amount?: number;
  payable_amount?: number;
}

export interface TransactionDetails {
  external_resource_url?: string;
  installment_amount?: number;
  financial_institution?: string;
  payment_method_reference_id?: string;
  net_received_amount?: number;
  total_paid_amount?: number;
  overpaid_amount?: number;
  payable_amount?: number;
  acquirer_reference?: string;
  payable_deferral_period?: any;
}

export interface Card {
  id: string;
  first_six_digits: string;
  last_four_digits: string;
  expiration_month: number;
  expiration_year: number;
  date_created?: string;
  date_last_updated?: string;
  cardholder?: {
    name: string;
    identification?: {
      type: string;
      number: string;
    };
  };
  card_number_length?: number;
  security_code_length?: number;
  expiration_required?: boolean;
  cardholder_identification_required?: boolean;
  cardholder_name_required?: boolean;
  cardholder_identification_type_required?: boolean;
  cardholder_identification_number_required?: boolean;
  esc?: boolean;
  card_pattern?: string;
  card_type?: string;
  card_issuer?: {
    id: number;
    name: string;
  };
  card_brand?: {
    id: string;
    name: string;
  };
}

export interface AdditionalInfo {
  ip_address?: string;
  items?: Array<{
    id: string;
    title: string;
    description?: string;
    picture_url?: string;
    category_id?: string;
    quantity: number;
    unit_price: number;
    unit_measure?: string;
    total_amount?: number;
  }>;
  payer?: {
    first_name?: string;
    last_name?: string;
    phone?: {
      area_code?: string;
      number?: string;
    };
    address?: {
      street_name?: string;
      street_number?: string;
      zip_code?: string;
    };
    registration_date?: string;
  };
  shipments?: {
    receiver_address?: {
      street_name?: string;
      street_number?: string;
      zip_code?: string;
      floor?: string;
      apartment?: string;
      city?: string;
      state?: string;
      country?: string;
    };
    zip_code?: string;
    street_name?: string;
    street_number?: string;
    floor?: string;
    apartment?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface PayerInfo {
  id: number;
  email: string;
  identification?: {
    type: string;
    number: string;
  };
  first_name: string;
  last_name: string;
  phone?: {
    area_code?: string;
    number?: string;
    extension?: string;
  };
  phone_extension?: string;
  date_created?: string;
  last_purchase?: string;
  type?: string;
  entity_type?: string;
}

export interface ThreeDSInfo {
  external_resource_url?: string;
  cre_token?: string;
}

export interface PointOfInteraction {
  type?: string;
  sub_type?: string;
  application_data?: {
    name?: string;
    version?: string;
  };
  transaction_data?: {
    qr_code?: {
      base64?: string;
      alve?: string;
    };
    ticket_url?: string;
  };
}

export interface MercadoPagoNotificationPayload {
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

export interface MercadoPagoWebhookEvent {
  id: string;
  type: string;
  topic: string;
  date_created: string;
  user_id: number;
  live_mode: boolean;
  version: number;
  data: {
    id: string;
  };
}

// Estados de pago según documentación oficial
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  AUTHORIZED: 'authorized',
  IN_PROCESS: 'in_process',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  CHARGED_BACK: 'charged_back'
} as const;

export type PaymentStatus = keyof typeof PAYMENT_STATUS;

export const PAYMENT_STATUS_DETAIL = {
  // Pending
  ACCREDITED_PENDING: 'accredited_pending',
  CONTINGENCY_PENDING: 'contingency_pending',
  REVIEWING_PENDING: 'reviewing_pending',
  CC_REVIEWING_PENDING: 'cc_reviewing_pending',
  MCC_REVIEWING_PENDING: 'mcc_reviewing_pending',
  PENDING_CONTINGENCY: 'pending_contingency',
  PENDING_CC_AUTHORIZATION: 'pending_cc_authorization',
  PENDING_CC_AUTHENTICATION: 'pending_cc_authentication',
  PENDING_PAYMENT_METHOD_SELECTED: 'pending_payment_method_selected',
  PENDING_REGULAR_PAYMENT: 'pending_regular_payment',
  
  // Approved
  ACCREDITED: 'accredited',
  PAID: 'paid',
  PARTIALLY_REFUNDED: 'partially_refunded',
  
  // In Process
  IN_PROCESS: 'in_process',
  IN_MEDIATION: 'in_mediation',
  PENDING_CHARGEBACK: 'pending_chargeback',
  PENDING_FRAUD_REVIEW: 'pending_fraud_review',
  
  // Rejected
  CC_REJECTED_BAD_FILLED_CARD_NUMBER: 'cc_rejected_bad_filled_card_number',
  CC_REJECTED_BAD_FILLED_DATE: 'cc_rejected_bad_filled_date',
  CC_REJECTED_BAD_FILLED_SECURITY_CODE: 'cc_rejected_bad_filled_security_code',
  CC_REJECTED_BAD_FILLED_OTHER: 'cc_rejected_bad_filled_other',
  CC_REJECTED_CALL_FOR_AUTHORIZE: 'cc_rejected_call_for_authorize',
  CC_REJECTED_CARD_DISABLED: 'cc_rejected_card_disabled',
  CC_REJECTED_CARD_EXPIRED: 'cc_rejected_card_expired',
  CC_REJECTED_CARD_REPORTED_STOLEN: 'cc_rejected_card_reported_stolen',
  CC_REJECTED_CARD_REPORTED_LOST: 'cc_rejected_card_reported_lost',
  CC_REJECTED_CARD_ERROR: 'cc_rejected_card_error',
  CC_REJECTED_HIGH_RISK: 'cc_rejected_high_risk',
  CC_REJECTED_INSUFFICIENT_AMOUNT: 'cc_rejected_insufficient_amount',
  CC_REJECTED_INVALID_INSTALLMENTS: 'cc_rejected_invalid_installments',
  CC_REJECTED_MAX_ATTEMPTS: 'cc_rejected_max_attempts',
  CC_REJECTED_OTHER_REASON: 'cc_rejected_other_reason',
  CC_REJECTED_DUPLICATE_PAYMENT: 'cc_rejected_duplicate_payment',
  CC_REJECTED_FRAUD: 'cc_rejected_fraud',
  CC_REJECTED_BLACKLIST: 'cc_rejected_blacklist',
  CC_REJECTED_BY_ML: 'cc_rejected_by_ml',
  CC_REJECTED_BY_BANK: 'cc_rejected_by_bank',
  
  // General
  BYPASSED: 'bypassed',
  REJECTED_BY_BANK: 'rejected_by_bank',
  REJECTED_BY_FRAUD: 'rejected_by_fraud',
  REJECTED_BY_REGULATIONS: 'rejected_by_regulations',
  REJECTED_AMOUNT: 'rejected_amount',
  REJECTED_DUPLICATE: 'rejected_duplicate',
  REJECTED_INSUFFICIENT_DATA: 'rejected_insufficient_data',
  REJECTED_METHOD_DISABLED: 'rejected_method_disabled',
  REJECTED_BY_BANK_FRAUD: 'rejected_by_bank_fraud',
  REJECTED_BY_TIME_LIMIT: 'rejected_by_time_limit',
  REJECTED_BY_BLACKLIST: 'rejected_by_blacklist',
  REJECTED_BY_HIGH_RISK: 'rejected_by_high_risk',
  REJECTED_BY_LOW_RISK: 'rejected_by_low_risk',
  REJECTED_BY_ML_FRAUD: 'rejected_by_ml_fraud',
  REJECTED_BY_ML_BLACKLIST: 'rejected_by_ml_blacklist',
  REJECTED_BY_ML_REGULATIONS: 'rejected_by_ml_regulations',
  REJECTED_BY_ML_AMOUNT: 'rejected_by_ml_amount',
  REJECTED_BY_ML_DUPLICATE: 'rejected_by_ml_duplicate',
  REJECTED_BY_ML_INSUFFICIENT_DATA: 'rejected_by_ml_insufficient_data',
  REJECTED_BY_ML_METHOD_DISABLED: 'rejected_by_ml_method_disabled',
  REJECTED_BY_ML_BANK_FRAUD: 'rejected_by_ml_bank_fraud',
  REJECTED_BY_ML_TIME_LIMIT: 'rejected_by_ml_time_limit',
  REJECTED_BY_ML_HIGH_RISK: 'rejected_by_ml_high_risk',
  REJECTED_BY_ML_LOW_RISK: 'rejected_by_ml_low_risk',
  
  // Cancelled
  BY_USER: 'by_user',
  BY_ADMIN: 'by_admin',
  BY_SPLIT: 'by_split',
  BY_MEDIATION: 'by_mediation',
  BY_FRAUD: 'by_fraud',
  BY_SYSTEM: 'by_system',
  BY_EXPIRED: 'by_expired',
  BY_CHARGED_BACK: 'by_charged_back',
  BY_REJECTED: 'by_rejected',
  BY_CANCELLED: 'by_cancelled',
  BY_REFUNDED: 'by_refunded',
  BY_DISPUTE: 'by_dispute',
  BY_CHARGEBACK: 'by_chargeback',
  BY_MEDIATION_DISPUTE: 'by_mediation_dispute',
  BY_MEDIATION_FRAUD: 'by_mediation_fraud',
  BY_MEDIATION_SYSTEM: 'by_mediation_system',
  BY_MEDIATION_EXPIRED: 'by_mediation_expired',
  BY_MEDIATION_CANCELLED: 'by_mediation_cancelled',
  BY_MEDIATION_REFUNDED: 'by_mediation_refunded'
} as const;

export type PaymentStatusDetail = keyof typeof PAYMENT_STATUS_DETAIL;

// Métodos de pago excluidos comúnmente
export const EXCLUDED_PAYMENT_TYPES = {
  TICKET: 'ticket',
  ATM: 'atm',
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
  PREPAID_CARD: 'prepaid_card',
  DIGITAL_CURRENCY: 'digital_currency',
  DIGITAL_WALLET: 'digital_wallet',
  BANK_TRANSFER: 'bank_transfer',
  PAYMENTS_API_LINK: 'payments_api_link'
} as const;

export type PaymentType = keyof typeof EXCLUDED_PAYMENT_TYPES;

// Interfaces para requests y responses de la API
export interface CreatePreferenceRequest {
  items: Array<{
    id: string;
    title: string;
    description?: string;
    picture_url?: string;
    category_id?: string;
    quantity: number;
    unit_price: number;
    currency_id?: string;
    unit_measure?: string;
    total_amount?: number;
  }>;
  payer?: {
    name?: string;
    surname?: string;
    email?: string;
    phone?: {
      area_code?: string;
      number?: string;
    };
    identification?: {
      type?: string;
      number?: string;
    };
    address?: {
      street_name?: string;
      street_number?: string;
      zip_code?: string;
    };
  };
  payment_methods?: {
    excluded_payment_methods?: Array<{ id: string }>;
    excluded_payment_types?: Array<{ id: string }>;
    default_payment_method_id?: string;
    default_installments?: number;
    installments?: number;
  };
  back_urls?: {
    success?: string;
    pending?: string;
    failure?: string;
  };
  auto_return?: 'approved' | 'pending';
  notification_url?: string;
  external_reference?: string;
  expires?: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
  shipments?: {
    receiver_address?: {
      zip_code?: string;
      street_name?: string;
      street_number?: string;
      floor?: string;
      apartment?: string;
      city?: string;
      state?: string;
      country?: string;
    };
    mode?: 'me1' | 'me2' | 'custom';
    local_pickup?: boolean;
    free_methods?: Array<{ id: number }>;
    cost?: number;
    free_shipping?: boolean;
    default_shipping_method?: number;
    dimensions?: string;
  };
  metadata?: Record<string, any>;
}

export interface CreatePreferenceResponse {
  id: string;
  init_point: string;
  external_reference: string;
  collector_id: number;
  client_id: number;
  date_created: string;
  items: PreferenceItem[];
  payer?: Payer;
  payment_methods?: PaymentMethods;
  back_urls?: BackUrls;
  auto_return?: string;
  notification_url?: string;
  expires?: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
  shipments?: Shipments;
  metadata?: Record<string, any>;
}

// Errores comunes de Mercado Pago
export interface MercadoPagoError {
  error: string;
  message: string;
  cause?: Array<{
    code?: string;
    description?: string;
    data?: any;
  }>;
  status?: number;
}

export interface RefundRequest {
  payment_id: string;
  amount?: number;
  reason?: string;
  external_reference?: string;
  metadata?: Record<string, any>;
}

export interface RefundResponse {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
  date_created: string;
  reason?: string;
  external_reference?: string;
  metadata?: Record<string, any>;
  source?: {
    name: string;
    id: string;
    type: string;
  };
  refund_mode?: string;
  adjustment_amount?: number;
  total_amount?: number;
  currency_id: string;
  refund_details?: Array<{
    type: string;
    amount: number;
    date_created: string;
  }>;
}
