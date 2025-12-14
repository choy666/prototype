// Mock global de MercadoPago para evitar problemas de inicialización (debe estar al principio)
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(),
  Payment: jest.fn(),
  payments: {
    find: jest.fn()
  },
  merchant_orders: {
    get: jest.fn()
  }
}));

import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';

// Suppress React JSX transform warning
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('outdated JSX transform')
  ) {
    return;
  }
  originalWarn(...args);
};

// Polyfills para Node.js
import { TextDecoder, TextEncoder } from 'util';
import { Buffer } from 'buffer';
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;
global.Buffer = Buffer;

// Mock de crypto con randomUUID (compatible con ES modules)
jest.mock('crypto', () => ({
  __esModule: true,
  default: {
    randomUUID: jest.fn(() => 'test-uuid-12345'),
    createHmac: jest.fn(),
    timingSafeEqual: jest.fn()
  },
  randomUUID: jest.fn(() => 'test-uuid-12345'),
  createHmac: jest.fn(),
  timingSafeEqual: jest.fn()
}));

// Mock de Request/Response para APIs de Next.js
global.Request = class Request {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init.method || 'GET';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.body = init.body;
  }
  
  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }
  
  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }
  
  async arrayBuffer() {
    const text = await this.text();
    const encoder = new TextEncoder();
    return encoder.encode(text).buffer;
  }
};

global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.headers = new Map(Object.entries(init.headers || {}));
  }
  
  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }
  
  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }
};

// Mock de fetch global
global.fetch = jest.fn();

// Mock de Next.js server components
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data, init) => ({
      status: init?.status || 200,
      json: async () => data,
      headers: new Map(Object.entries(init?.headers || {})),
      ok: (init?.status || 200) < 400
    })
  },
  NextRequest: class MockNextRequest {
    constructor(input, init = {}) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init?.method || 'GET';
      this.headers = new Map(Object.entries(init?.headers || {}));
      this.body = init?.body;
    }
    
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }
  }
}));

// Mock de Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock de next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signOut: jest.fn(),
  signIn: jest.fn(),
}));

// Mock de Zustand
jest.mock('zustand', () => ({
  create: jest.fn(() => jest.fn()),
}));

// Mock de componentes que requieren configuración especial
jest.mock('@/lib/actions/products', () => ({
  getFeaturedProducts: jest.fn(() => Promise.resolve([])),
}));

// Mock de next/cache para evitar errores en tests
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/actions/auth', () => ({
  auth: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@/hooks/useProducts', () => ({
  useProducts: jest.fn(() => ({
    products: [],
    isLoading: false,
    error: null,
    pagination: { page: 1, totalPages: 1, total: 0 },
    updateFilters: jest.fn(),
    filters: {},
    refresh: jest.fn(),
  })),
}));

jest.mock('@/lib/stores/useCartStore', () => ({
  useCartStore: jest.fn(() => 0),
  selectTotalItems: jest.fn(() => 0),
}));

// Mock de logger para evitar errores en webhooks
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}));

// Mock de dependencias del webhook de MercadoPago
jest.mock('@/lib/mercado-pago/hmacVerifier', () => ({
  verifyMercadoPagoWebhook: jest.fn(() => ({ 
    ok: true, 
    dataId: 'payment-123' 
  }))
}));

jest.mock('@/lib/actions/webhook-failures', () => ({
  saveDeadLetterWebhook: jest.fn()
}));

jest.mock('@/lib/actions/payment-processor', () => ({
  processPaymentWebhook: jest.fn(),
  checkPaymentIdempotency: jest.fn()
}));
