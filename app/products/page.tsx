'use client';

import { ProductFilters } from '@/components/products/ProductFilters';
import { useProducts } from '@/hooks/useProducts';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { getDiscountedPrice } from '@/lib/utils/pricing';
import type { Product } from '@/lib/schema';

export default function ProductsPage() {
  const {
    products,
    isLoading,
    error,
    pagination,
    updateFilters,
    filters,
    refresh
  } = useProducts({
    page: 1,
    limit: 12,
    sortBy: 'name',
    sortOrder: 'asc'
  });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error al cargar los productos</h2>
          <p className="text-gray-600 mb-6">{error.message}</p>
          <Button
            onClick={refresh}
            variant="outline"
            className="bg-blue-50 hover:bg-blue-100 text-blue-700"
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Nuestros Productos</h1>
        <p className="text-gray-600">Descubre nuestra selección de productos de alta calidad</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 lg:w-80">
          <ProductFilters
            filters={filters}
            onFilterChange={updateFilters}
            priceRange={{ min: 0, max: 1000 }}
          />
        </aside>

        <main className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="mb-6 text-sm text-gray-500">
                Mostrando {products.length} de {pagination?.total || 0} productos
              </div>

              {products.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg text-gray-600">No se encontraron productos</p>
                  <Button
                    onClick={() => updateFilters({})}
                    variant="outline"
                    className="mt-4"
                  >
                    Limpiar filtros
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}

              {pagination && pagination.totalPages > 1 && (
                <div className="mt-12 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="text-sm text-gray-500">
                    Mostrando página {pagination.page} de {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => updateFilters({ page: Math.max(1, pagination.page - 1) })}
                      disabled={pagination.page <= 1}
                      variant="outline"
                      className="min-w-[100px]"
                    >
                      Anterior
                    </Button>
                    <Button
                      onClick={() => updateFilters({ page: pagination.page + 1 })}
                      disabled={pagination.page >= pagination.totalPages}
                      className="min-w-[100px]"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const hasDiscount = product.discount > 0;
  const finalPrice = getDiscountedPrice(product);

  return (
    <div className="group relative bg-black rounded-lg cursor-pointer p-1">
      <Link href={`/products/${product.id}`} className="block">
        <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden relative">
          {product.image ? (
            <div className="relative w-full h-full bg-black">
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-lg">
              <span className="text-gray-400">Sin imagen</span>
            </div>
          )}

          {product.stock === 0 && (
            <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full">
              Agotado
            </div>
          )}

          <DiscountBadge discount={product.discount} />
        </div>

        <div className="mt-5 flex mb-5 ml-3 items-center justify-between">
          <h3 className="text-sm font-medium text-white h-10 mr-5 ml-2">
            {product.name}
          </h3>
          <div className="flex flex-col items-end">
            {hasDiscount ? (
              <>
                <span className="text-xs text-gray-400 line-through">
                  ${Number(product.price).toFixed(2)}
                </span>
                <span className="text-sm font-bold text-white">
                  ${finalPrice.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="text-sm font-bold text-white">
                ${Number(product.price).toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-square bg-gray-200 rounded-lg"></div>
      <div className="mt-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
      <div className="mt-2 h-6 bg-gray-200 rounded w-1/3"></div>
    </div>
  );
}