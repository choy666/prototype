'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { getProducts as fetchProducts } from '@/lib/actions/products';
import type { ProductFilters } from '@/types';
import type { Product } from '@/lib/schema'; // ✅ Usamos el tipo de Drizzle

// Normalización fuerte
function normalizeFilters(input: Partial<ProductFilters>): ProductFilters {
  return {
    category: input.category ?? undefined,
    minPrice: typeof input.minPrice === 'number' ? input.minPrice : undefined,
    maxPrice: typeof input.maxPrice === 'number' ? input.maxPrice : undefined,
    search: input.search?.trim() || undefined,
    sortBy: input.sortBy ?? 'created_at',
    sortOrder: input.sortOrder ?? 'desc',
    page: typeof input.page === 'number' ? input.page : 1,
    limit: typeof input.limit === 'number' ? input.limit : 12,
    minDiscount: typeof input.minDiscount === 'number' ? input.minDiscount : undefined,
  };
}

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
  const didMountRef = useRef(false);

  const initialFromUrl: Partial<ProductFilters> = {
    category: searchParams.has('category') ? searchParams.get('category')! : undefined,
    minPrice: searchParams.has('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.has('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    search: searchParams.get('search') || undefined,
    sortBy: (searchParams.get('sortBy') as ProductFilters['sortBy']) || undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
    page: searchParams.has('page') ? Number(searchParams.get('page')) : undefined,
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
    minDiscount: searchParams.has('minDiscount') ? Number(searchParams.get('minDiscount')) : undefined,
  };

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
  }>(() => {
    const merged = normalizeFilters({ ...initialFromUrl, ...initialFilters });
    return {
      products: [],
      isLoading: true,
      error: null,
      pagination: {
        total: 0,
        page: merged.page ?? 1,
        limit: merged.limit ?? 12,
        totalPages: 1,
      },
      filters: merged,
    };
  });

  const updateFilters = useCallback((newFilters: Partial<ProductFilters>) => {
    setState(prev => {
      const merged = normalizeFilters({ ...prev.filters, ...newFilters, page: 1 });
      return {
        ...prev,
        filters: merged,
        pagination: {
          ...prev.pagination,
          page: merged.page ?? 1,
          limit: merged.limit ?? 12,
        },
      };
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(state.filters).forEach(([key, value]) => {
      if (value === undefined || value === '') return;
      if (key === 'category' && (value === 'all' || value === undefined)) return;
      params.set(key, String(value));
    });

    const next = params.toString();
    const current = searchParams.toString();

    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [state.filters, router, pathname, searchParams]);

  const fetchProductsData = useCallback(async (filters: ProductFilters) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const normalized = normalizeFilters(filters);

      const { data, pagination } = await fetchProducts(
        normalized.page,
        normalized.limit,
        {
          category: normalized.category ?? undefined,
          minPrice: normalized.minPrice,
          maxPrice: normalized.maxPrice,
          search: normalized.search,
          sortBy: normalized.sortBy,
          sortOrder: normalized.sortOrder,
          minDiscount: normalized.minDiscount,
        }
      );

      // ✅ Normalizamos image y description para evitar errores de tipo
      const safeProducts: Product[] = data.map(product => ({
        ...product,
        image: product.image ?? null,
        description: product.description ?? null,
        created_at: product.created_at instanceof Date ? product.created_at : new Date(product.created_at),
        updated_at: product.updated_at instanceof Date ? product.updated_at : new Date(product.updated_at),
      }));

      setState(prev => ({
        ...prev,
        products: safeProducts,
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