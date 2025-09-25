// components/products/ProductGrid.tsx
'use client';

import { Product } from '@/lib/schema';
import { ProductCard, ProductCardSkeleton } from './ProductCard';
import { ProductFilters } from './ProductFilters';
import { ProductSort } from './ProductSort';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getProducts } from '@/lib/actions/products';
import { Button } from '@/components/ui/Button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductGridProps {
  initialProducts?: Product[];
  totalCount?: number;
  className?: string;
}

type ProductsResponse = {
  data: Product[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
  filters: {
    category?: string;
    search?: string;
    sort?: string;
  };
};

export function ProductGrid({ 
  initialProducts = [], 
  totalCount = 0,
  className = '' 
}: ProductGridProps) {
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'newest';

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    error,
  } = useInfiniteQuery({
    queryKey: ['products', { search, category, sort }],
    queryFn: async ({ pageParam = 1 }) => {
      const result = await getProducts(
        pageParam,
        12, // limit
        { 
          search, 
          category,
          sortBy: sort === 'newest' ? 'created_at' : 'price',
          sortOrder: sort === 'price_asc' ? 'asc' : 'desc'
        }
      );
      return {
        data: result.data,
        pagination: {
          total: result.pagination.total,
          page: result.pagination.page,
          limit: result.pagination.limit,
        },
        filters: {
          category,
          search,
          sort
        }
      } as ProductsResponse;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1;
      const totalPages = Math.ceil(lastPage.pagination.total / lastPage.pagination.limit);
      return nextPage <= totalPages ? nextPage : undefined;
    },
    initialData: initialProducts.length > 0 
      ? { 
          pages: [{
            data: initialProducts,
            pagination: {
              total: totalCount,
              page: 1,
              limit: 12
            },
            filters: { category, search, sort }
          }], 
          pageParams: [1] 
        } 
      : undefined,
  });

  const products = data?.pages.flatMap(page => page.data) || [];
  const totalProducts = data?.pages[0]?.pagination.total || 0;

  if (isPending && !initialProducts.length) {
    return <ProductGridSkeleton />;
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center">
        <p className="text-destructive font-medium">Error al cargar los productos</p>
        <p className="text-sm text-muted-foreground mt-2">
          {error.message || 'Intenta de nuevo más tarde.'}
        </p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4 rounded-lg border border-dashed p-8 text-center">
        <h3 className="text-lg font-medium">No se encontraron productos</h3>
        <p className="text-sm text-muted-foreground">
          Intenta con otros filtros o vuelve más tarde.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Filtros y Ordenamiento */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          Mostrando <span className="font-medium">{products.length}</span> de{' '}
          <span className="font-medium">{totalProducts}</span> productos
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ProductFilters />
          <ProductSort />
        </div>
      </div>

      {/* Grid de productos */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard 
            key={product.id} 
            product={product} 
            onAddToCart={(productId) => {
              console.log('Añadir al carrito:', productId);
              // Aquí iría la lógica para añadir al carrito
            }}
          />
        ))}
      </div>

      {/* Botón de cargar más */}
      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full sm:w-auto"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando...
              </>
            ) : (
              'Cargar más productos'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// Componente Skeleton para la cuadrícula de productos
export function ProductGridSkeleton({ 
  className = '',
  items = 8 
}: { 
  className?: string;
  items?: number;
}) {
  return (
    <div className={cn('space-y-8', className)}>
      {/* Encabezado con contadores y filtros */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <Skeleton className="h-6 w-48" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      {/* Grid de productos en carga */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: items }).map((_, index) => (
          <ProductCardSkeleton key={`skeleton-${index}`} />
        ))}
      </div>

      {/* Pie de página con contador de carga */}
      <div className="flex items-center justify-center py-4">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Cargando productos...</span>
        </div>
      </div>
    </div>
  );
}