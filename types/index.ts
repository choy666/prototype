// app/types/index.ts
export interface User {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  emailVerified?: Date | null;
  image?: string | null;
}

export interface ProductVariant {
  id: number;
  productId: number;
  name: string;
  description?: string | null;
  sku?: string | null;
  additionalAttributes?: Record<string, string>;
  price?: string | null;
  stock: number;
  images?: string[];
  isActive: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ProductAttribute {
  name: string;
  values: string[];
}

export interface Product {
  discount: number;
  id: number;
  name: string;
  description: string | null;
  price: string;
  image?: string | string[] | null;
  images?: string[]; // Array de imágenes secundarias
  attributes?: Record<string, string>;
  category: string;
  destacado: boolean;
  stock: number;
  variants?: ProductVariant[];
  created_at: Date | string;
  updated_at: Date | string;
}

export type UserRole = 'user' | 'admin';

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minStock?: number;
  maxStock?: number;
  search?: string;
  sortBy?:
    | 'name'
    | 'price'
    | 'category'
    | 'created_at'
    | 'updated_at'
    | 'stock'
    | 'discount'; // 🔥 agregado para soportar orden por descuento
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  minDiscount?: number; // 🔥 agregado para la categoría OFERTAS
  featured?: boolean;
  mlSyncStatus?: 'pending' | 'syncing' | 'synced' | 'error' | 'conflict';
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Respuesta de la API de productos
export interface ProductsResponse {
  data: Product[];
  pagination: Pagination;
  filters?: Partial<ProductFilters>;
}

// Tipos para el hook useProducts
export interface UseProductsReturn {
  products: Product[];
  isLoading: boolean;
  error: Error | null;
  pagination: Pagination;
  filters: ProductFilters;
  refresh: () => Promise<void>;
  updateFilters: (newFilters: Partial<ProductFilters>) => void;
}

// Tipos para errores
export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

// Tipos para autenticación
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  name: string;
  confirmPassword: string;
}

// Tipos para respuestas de la API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  created_at?: Date | string;
  updated_at?: Date | string;
}

// Hooks
export type UseParamsResult<T = Record<string, string | string[] | undefined>> = {
  params: T;
  isLoading: boolean;
  error: Error | null;
};

// Tipo para el hook useSearchParams
export type UseSearchParamsResult = {
  searchParams: URLSearchParams;
  setSearchParams: (params: Record<string, string | string[] | undefined>) => void;
};

// Tipos para Checkout y Envío
export interface ShippingAddress {
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  telefono: string;
}

export interface CheckoutData {
  items: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    image?: string;
    discount?: number;
    variantId?: number;
  }>;
  shippingAddress: ShippingAddress;
  userId?: string;
}

export interface Order {
  id: number;
  userId: number;
  total: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  paymentId?: string | null;
  mercadoPagoId?: string | null;
  shippingAddress?: ShippingAddress | null;
  createdAt: Date;
  updatedAt: Date;
}

// Tipos para métodos de envío
export interface ShippingMethod {
  id: number;
  name: string;
  description?: string;
  cost: number;
  estimatedDays?: number;
  type?: 'standard' | 'express' | 'pickup';
  freeShippingThreshold?: number;
}

// Tipos para Mercado Libre
export interface MercadoLibreProduct {
  id: string;
  title: string;
  category_id: string;
  price: number;
  currency_id: string;
  available_quantity: number;
  buying_mode: 'buy_it_now' | 'auction';
  listing_type_id: string;
  condition: 'new' | 'used';
  description?: string;
  pictures?: Array<{
    id: string;
    url: string;
    secure_url: string;
    size: string;
    max_size: string;
    quality: string;
  }>;
  video_id?: string;
  attributes?: Array<{
    id: string;
    name: string;
    value_id: string;
    value_name: string;
  }>;
  warranty?: string;
  tags?: string[];
}

export interface MercadoLibreSyncStatus {
  id: number;
  productId: number;
  mlItemId?: string | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'conflict';
  lastSyncAt?: Date | null;
  syncError?: string | null;
  mlData?: any;
  syncAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MercadoLibreConnectionStatus {
  connected: boolean;
  userId?: string;
  nickname?: string;
  scopes?: string[];
  expiresAt?: string;
  error?: string;
  reason?: string;
  refreshed?: boolean;
  hasCriticalScopes?: boolean;
  missingCriticalScopes?: string[];
}

// Re-exportar tipos especializados
export * from './mercadolibre';
export type { 
  MLShipment, 
  MLShipmentTracking 
} from './mercadolibre';
export * from './common';

