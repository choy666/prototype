export interface User {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  emailVerified?: Date | null;
  image?: string | null;
}

export interface Product {
  id: number;
  name: string;
  description?: string | null;
  price: string;
  image?: string | string[] | null;  // Allow null
  category: string;
  destacado: boolean;
  stock: number;
  created_at: Date | string;
  updated_at: Date | string;
}

export type UserRole = 'user' | 'admin';



// Filtros y paginación
export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: 'name' | 'price' | 'category' | 'created_at' | 'updated_at' | 'stock';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
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

// Tipos para páginas
export interface PageParams {
  params: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
  searchParams?: { [key: string]: string | string[] | undefined };
}

export interface PageProps {
  params: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
  searchParams?: {
    [key: string]: string | string[] | undefined;
  };
}

// Para páginas de producto
export interface ProductPageProps extends Omit<PageProps, 'params'> {
  params: Promise<{
    id: string;
    [key: string]: string | string[] | undefined;
  }>;
}

// Tipo para el hook useParams
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