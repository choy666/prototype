import mercadopago from 'mercadopago';

// Mock completo de MercadoPago SDK
jest.mock('mercadopago', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    preferences: {
      create: jest.fn()
    },
    payments: {
      find: jest.fn(),
      refund: jest.fn(),
      capture: jest.fn()
    },
    merchant_orders: {
      get: jest.fn()
    },
    notifications: {
      get: jest.fn()
    }
  }
}));

// Helper para crear mocks de respuestas de MercadoPago
export const createMockPreference = (overrides = {}) => ({
  id: 'pref-test-123456789',
  init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test-123456789',
  sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=test-123456789',
  collector_id: 123456789,
  client_id: 'test-client-id',
  date_created: new Date().toISOString(),
  items: [],
  payer: {
    email: 'test@example.com',
    identification: {
      type: 'DNI',
      number: '12345678'
    }
  },
  payment_methods: {
    excluded_payment_methods: [],
    excluded_payment_types: [],
    installments: 12,
    default_payment_method_id: null,
    default_installments: null
  },
  shipments: {
    receiver_address: {},
    free_shipping: false,
    mode: 'me2'
  },
  back_urls: {
    success: 'http://localhost:3000/payment/success',
    failure: 'http://localhost:3000/payment/failure',
    pending: 'http://localhost:3000/payment/pending'
  },
  auto_return: 'approved',
  external_reference: 'order-test-123',
  expires: false,
  expiration_date_from: null,
  expiration_date_to: null,
  ...overrides
});

export const createMockPayment = (overrides = {}) => ({
  id: 'payment-test-123456789',
  date_created: new Date().toISOString(),
  date_approved: new Date().toISOString(),
  date_last_updated: new Date().toISOString(),
  money_release_date: new Date().toISOString(),
  operation_type: 'regular_payment',
  issuer_id: null,
  payment_method_id: 'visa',
  payment_type_id: 'credit_card',
  status: 'approved',
  status_detail: 'accredited',
  currency_id: 'ARS',
  description: 'Test payment',
  live_mode: false,
  sponsor_id: null,
  authorization_code: '1234567890',
  money_release_schema: 'default',
  taxes_amount: 0,
  counter_currency: null,
  shipping_amount: 500,
  pos_id: null,
  store_id: null,
  payer: {
    id: 'payer-test-123',
    email: 'test@example.com',
    identification: {
      type: 'DNI',
      number: '12345678'
    },
    first_name: 'Test',
    last_name: 'User',
    phone: {
      area_code: '11',
      number: '987654321'
    }
  },
  collector_id: 123456789,
  metadata: {},
  order: null,
  external_reference: 'order-test-123',
  transaction_amount: 10000,
  transaction_amount_refunded: 0,
  coupon_amount: 0,
  differential_pricing_id: null,
  deduction_schema: null,
  transaction_details: {
    payment_method_reference_id: null,
    net_received_amount: 9500,
    total_paid_amount: 10000,
    overpaid_amount: 0,
    external_resource_url: null,
    installments: 1,
    financial_institution: null,
    payable_deferred_period: null,
  },
  fee_details: [],
  captured: true,
  binary_mode: false,
  call_for_authorize_id: null,
  statement_descriptor: null,
  installments: 1,
  card: {
    id: 'card-test-123',
    first_six_digits: '411111',
    last_four_digits: '1111',
    expiration_month: 12,
    expiration_year: 2025,
    date_created: new Date().toISOString(),
    date_last_updated: new Date().toISOString(),
    cardholder: {
      name: 'Test User',
      identification: {
        type: 'DNI',
        number: '12345678'
      }
    }
  },
  notification_url: null,
  refunds: [],
  processing_mode: 'aggregator',
  merchant_account_id: null,
  acquirer: null,
  merchant_number: null,
  ...overrides
});

export const createMockMerchantOrder = (overrides = {}) => ({
  id: 'order-test-123456789',
  date_created: new Date().toISOString(),
  last_updated: new Date().toISOString(),
  external_reference: 'order-test-123',
  preference_id: 'pref-test-123456789',
  collector_id: 123456789,
  site_id: 'MLA',
  sponsor_id: null,
  customer_id: null,
  order_status: 'paid',
  status_detail: null,
  expiration_date: null,
  date_closed: new Date().toISOString(),
  shipping_cost: 500,
  total_amount: 10500,
  marketplace_fee: 0,
  coupon_amount: 0,
  items: [],
  payments: [],
  additional_info: null,
  shipments: [],
  payouts: [],
  blocked: false,
  ...overrides
});

// Mock de respuestas de error
export const createMockMercadoPagoError = (message: string, status: number = 400) => ({
  cause: [{
    code: status.toString(),
    description: message,
    data: null
  }],
  error: message,
  message: message,
  status: status
});

// Helper para mockear respuestas de la API
export const mockMercadoPagoAPI = {
  preference: {
    success: (data = {}) => ({
      body: createMockPreference(data),
      status: 201
    }),
    error: (message: string, status: number = 400) => {
      throw createMockMercadoPagoError(message, status);
    }
  },
  payment: {
    success: (data = {}) => ({
      body: createMockPayment(data),
      status: 200
    }),
    error: (message: string, status: number = 400) => {
      throw createMockMercadoPagoError(message, status);
    }
  },
  merchantOrder: {
    success: (data = {}) => ({
      body: createMockMerchantOrder(data),
      status: 200
    }),
    error: (message: string, status: number = 400) => {
      throw createMockMercadoPagoError(message, status);
    }
  }
};
