'use client';

import { ProductFilters } from '@/components/products/ProductFilters';
import { useProducts } from '@/hooks/useProducts';
import { productSchema } from '@/hooks/useProducts';
import Link from 'next/link';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/Button';
import z from 'zod';

export default function ProductsPage() {
  // Initialize products with filters
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

  // Handle error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error al cargar los productos</h2>
          <p className="text-gray-600 mb-6">{error.message}</p>
          <Button 
            onClick={() => refresh()}
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
      {/* Header Section */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Nuestros Productos</h1>
        <p className="text-gray-600">Descubre nuestra selección de productos de alta calidad</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Filters Sidebar */}
        <aside className="w-full md:w-64 lg:w-80">
          <ProductFilters 
            filters={filters}
            onFilterChange={updateFilters} 
            priceRange={{ min: 0, max: 1000 }} // Adjust based on your product prices
          />
        </aside>

        {/* Products Grid */}
        <main className="flex-1">
          {/* Loading State */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              {/* Products Count */}
              <div className="mb-6 text-sm text-gray-500">
                Mostrando {products.length} de {pagination?.total || 0} productos
              </div>

              {/* Products Grid */}
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

              {/* Pagination */}
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

// Product Card Component
function ProductCard({ product }: { product: z.infer<typeof productSchema> }) {
  return (
    <Link 
      href={`/products/${product.id}`}
      className="group border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 bg-white h-full flex flex-col"
    >
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        {product.image ? (
          <div className="relative w-full h-full">
            <Image 
              src={product.image} 
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              priority={false}
            />
          </div>
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <span className="text-gray-400">Sin imagen</span>
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full">
            Agotado
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
          {product.name}
        </h3>
        <p className="text-lg font-bold text-gray-900 mt-1">
          ${Number(product.price).toFixed(2)}
        </p>
        {product.category && (
          <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full mt-2 self-start">
            {product.category}
          </span>
        )}
        {product.description && (
          <p className="mt-2 text-sm text-gray-600 line-clamp-2">
            {product.description}
          </p>
        )}
        {product.stock > 0 && product.stock <= 5 && (
          <p className="text-xs text-amber-600 mt-2">
            ¡Solo quedan {product.stock} en stock!
          </p>
        )}
      </div>
    </Link>
  );
}

// Skeleton Loader for Products
function ProductCardSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Skeleton className="w-full aspect-square" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3 mt-2" />
      </div>
    </div>
  );
}