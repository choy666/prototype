// Tipos básicos para operaciones CRUD
// Se recomienda usar consultas directas de Drizzle ORM que ya son type-safe

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortOptions {
  field?: string;
  order?: 'asc' | 'desc';
}

export interface FilterOptions {
  search?: string;
  searchFields?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters?: Record<string, any>;
}

export interface QueryOptions extends PaginationOptions, SortOptions, FilterOptions {
  includeRelations?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
