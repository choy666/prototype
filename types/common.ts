// Tipos comunes y genéricos para el proyecto

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters?: Record<string, any>;
}

export interface ApiError {
  message: string;
  statusCode: number;
  code?: string;
  details?: Record<string, any>;
  timestamp?: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SortOptions {
  field: string;
  order: 'asc' | 'desc';
}

export interface FilterOptions {
  search?: string;
  category?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  minPrice?: number;
  maxPrice?: number;
  [key: string]: any;
}

// Tipos para entidades normalizadas del sistema
export interface NormalizedOrder {
  id: number;
  userId: number;
  email: string;
  total: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'rejected';
  paymentId?: string;
  mercadoPagoId?: string;
  mercadoLibreOrderId?: string;
  mercadoLibreShipmentId?: string;
  shippingAddress?: NormalizedAddress;
  shippingMethodId?: number;
  shippingCost: number;
  shippingStatus?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  items: NormalizedOrderItem[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface NormalizedOrderItem {
  id: number;
  orderId: number;
  productId: number;
  variantId?: number;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  price: string;
  createdAt: Date;
}

export interface NormalizedShipment {
  id: string;
  orderId: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'failed' | 'cancelled' | 'returned';
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  senderAddress: NormalizedAddress;
  receiverAddress: NormalizedAddress;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    dimensions: {
      height: number;
      width: number;
      length: number;
      weight: number;
    };
  }>;
  cost: number;
  currencyId: string;
  createdAt: Date;
  updatedAt: Date;
  mercadoLibreShipmentId?: string;
  mercadoLibreStatus?: string;
  mercadoLibreSubstatus?: string;
}

export interface NormalizedAddress {
  id?: number;
  street: string;
  number: string;
  city: string;
  province: string;
  postalCode: string;
  country?: string;
  floor?: string;
  apartment?: string;
  observations?: string;
  latitude?: number;
  longitude?: number;
}

// Tipos para integraciones
export interface IntegrationStatus {
  connected: boolean;
  lastSync?: Date;
  error?: string;
  credentials?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  };
  metadata?: Record<string, any>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  source: 'mercadopago' | 'mercadolibre';
  data: Record<string, any>;
  processed: boolean;
  attempts: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

// Tipos para auditoría y logging
export interface AuditLog {
  id: number;
  userId?: number;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
}

export interface SystemMetrics {
  totalOrders: number;
  totalRevenue: number;
  activeUsers: number;
  conversionRate: number;
  averageOrderValue: number;
  MercadoPagoStatus: IntegrationStatus;
  MercadoLibreStatus: IntegrationStatus;
  lastUpdated: Date;
}

// Tipos para configuración
export interface AppConfig {
  mercadoPago: {
    enabled: boolean;
    accessToken?: string;
    webhookUrl?: string;
    sandbox?: boolean;
  };
  mercadoLibre: {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    scopes?: string[];
  };
  shipping: {
    freeShippingThreshold: number;
    baseCost: number;
    weightRate: number;
    sizeSurcharge: number;
    provinceMultipliers: Record<string, number>;
  };
  notifications: {
    email?: {
      enabled: boolean;
      provider?: string;
      from?: string;
    };
    sms?: {
      enabled: boolean;
      provider?: string;
      from?: string;
    };
    push?: {
      enabled: boolean;
      vapidPublicKey?: string;
    };
  };
}

// Tipos para cola de procesamiento
export interface QueueItem<T = any> {
  id: number;
  type: string;
  data: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: 'low' | 'normal' | 'high' | 'critical';
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  nextRetryAt?: Date;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

// Tipos para archivos y medios
export interface FileUpload {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  path: string;
  uploadedAt: Date;
  metadata?: Record<string, any>;
}

// Tipos para búsqueda y filtrado
export interface SearchParams {
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface SearchResult<T = any> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  facets?: Record<string, Array<{
    value: string;
    count: number;
  }>>;
  suggestions?: string[];
}

// Tipos para validación
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: any;
}

// Tipos para caché
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt?: Date;
  createdAt: Date;
  accessedAt: Date;
  hitCount: number;
}

// Tipos para eventos del sistema
export interface SystemEvent {
  id: string;
  type: string;
  source: string;
  data: Record<string, any>;
  timestamp: Date;
  userId?: number;
  sessionId?: string;
  correlationId?: string;
}

// Tipos para respuestas HTTP estándar
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Tipos para environment variables
export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  NEXT_PUBLIC_APP_URL: string;
  DATABASE_URL: string;
  MERCADO_PAGO_ACCESS_TOKEN?: string;
  MERCADOLIBRE_CLIENT_ID?: string;
  MERCADOLIBRE_CLIENT_SECRET?: string;
  MERCADOLIBRE_REDIRECT_URI?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  JWT_SECRET?: string;
  WEBHOOK_SECRET?: string;
}

// Tipos utilitarios
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type IdType = string | number;

export type Timestamps = {
  createdAt: Date;
  updatedAt: Date;
};

export type SoftDelete = {
  deletedAt?: Date;
  isDeleted: boolean;
};

// Exportación de tipos combinados
export type { 
  User, 
  Product, 
  ProductVariant, 
  Order, 
  ShippingMethod,
  ShippingAddress 
} from './index';

export type { 
  MercadoPagoPreference,
  MercadoPagoPayment,
  MercadoPagoNotificationPayload 
} from './mercadopago';

export type { 
  MLOrder,
  MLItem,
  MLShipment,
  MLWebhookEvent 
} from '@/types/mercadolibre';
