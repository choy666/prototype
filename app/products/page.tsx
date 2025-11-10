'use client';

import { ProductFilters } from '@/components/products/ProductFilters';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductCardSkeleton } from '@/components/products/ProductCardSkeleton';
import { useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/Button';

export default function ProductsPage() {
  const {
    products,
    isLoading,
    error,
    pagination,
    updateFilters,
    filters,
    refresh
  } = useProducts({ page: 1, limit: 12, sortBy: 'name', sortOrder: 'asc' });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            Error al cargar los productos
          </h2>
          <p className="text-gray-600 mb-6">{error.message}</p>
          <Button
            onClick={refresh}
            variant="outline"
            className="bg-gray-900 hover:bg-gray-800 text-blue-700"
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Nuestros Productos</h1>
        <p className="text-gray-600">
          Descubre nuestra selección de productos de alta calidad
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Filtros */}
        <aside className="w-full md:w-64 lg:w-80">
          <ProductFilters
            filters={filters}
            onFilterChange={updateFilters}
            priceRange={{ min: 0, max: 1000 }}
          />
        </aside>

        {/* Listado de productos */}
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

              {/* Paginación */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-12 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="text-sm text-gray-500">
                    Mostrando página {pagination.page} de {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        updateFilters({ page: Math.max(1, pagination.page - 1) })
                      }
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