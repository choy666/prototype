// hooks/useProducts.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { getProducts as fetchProducts } from '@/lib/actions/products';

// Esquema de validación para los productos
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  price: z.string(),
  image: z.string().nullable().optional(),
  category: z.string(),
  stock: z.number(),
  destacado: z.boolean(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type Product = z.infer<typeof productSchema>;

export type ProductFilters = {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: 'name' | 'price' | 'category' | 'created_at' | 'updated_at' | 'stock';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

type UseProductsReturn = {
  products: Product[];
  isLoading: boolean;
  error: Error | null;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: ProductFilters;
  refresh: () => Promise<void>;
  updateFilters: (newFilters: Partial<ProductFilters>) => void;
};

export function useProducts(initialFilters: Partial<ProductFilters> = {}): UseProductsReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<{
    products: Product[];
    isLoading: boolean;
    error: Error | null;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    filters: ProductFilters;
  }>({
    products: [],
    isLoading: true,
    error: null,
    pagination: {
      total: 0,
      page: 1,
      limit: 12,
      totalPages: 1,
    },
    filters: {
      category: searchParams.get('category') || undefined,
      minPrice: searchParams.has('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
      maxPrice: searchParams.has('maxPrice') ? Number(searchParams.get('maxPrice')) : 1000,
      search: searchParams.get('search') || undefined,
      sortBy: (searchParams.get('sortBy') as ProductFilters['sortBy']) || 'created_at',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      page: searchParams.has('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : 12,
      ...initialFilters,
    },
  });

  const updateFilters = useCallback((newFilters: Partial<ProductFilters>) => {
    setState(prev => {
      const updatedFilters = { ...prev.filters, ...newFilters, page: 1 }; // Reset to page 1 on filter change
      
      // Actualizar la URL
      const params = new URLSearchParams();
      Object.entries(updatedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.set(key, String(value));
        }
      });
      
      // Usar el router de Next.js para actualizar la URL sin recargar
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      
      return { 
        ...prev, 
        filters: updatedFilters,
        pagination: {
          ...prev.pagination,
          page: 1 // Resetear a la primera página al cambiar filtros
        }
      };
    });
  }, [router, pathname]);

  const fetchProductsData = useCallback(async (filters: ProductFilters) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { data, pagination } = await fetchProducts(
        filters.page || 1,
        filters.limit || 12,
        {
          category: filters.category,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          search: filters.search,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        }
      );

      const validatedProducts = data.map(product => productSchema.parse(product));

      setState(prev => ({
        ...prev,
        products: validatedProducts,
        pagination: {
          total: pagination.total,
          page: pagination.page,
          limit: pagination.limit,
          totalPages: Math.ceil(pagination.total / pagination.limit),
        },
        isLoading: false,
      }));

    } catch (err) {
      console.error('Error fetching products:', err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error('Error desconocido'),
        isLoading: false,
      }));
    }
  }, []);

  // Efecto para cargar productos cuando cambian los filtros
  useEffect(() => {
    fetchProductsData(state.filters);
  }, [fetchProductsData, state.filters]);

  const refresh = useCallback(async () => {
    await fetchProductsData(state.filters);
  }, [fetchProductsData, state.filters]);

  return {
    products: state.products,
    isLoading: state.isLoading,
    error: state.error,
    pagination: state.pagination,
    filters: state.filters,
    refresh,
    updateFilters,
  };
}