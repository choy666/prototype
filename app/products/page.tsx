'use client';
import React from 'react';
import { ProductGrid } from '@/components/products/ProductGrid';
import { ProductFilters } from '@/components/products/ProductFilters';

export default function ProductsPage({
  searchParams,
}: {
  searchParams: {
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    search?: string;
    sort?: string;
    page?: string;
  };
}) {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Nuestros Productos</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1">
          <ProductFilters 
            initialFilters={{
              category: searchParams.category,
              minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
              maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
              search: searchParams.search,
              sortBy: searchParams.sort?.split('_')[0],
              sortOrder: searchParams.sort?.split('_')[1] as 'asc' | 'desc' | undefined
            }}
          />
        </div>
        
        <div className="md:col-span-3">
          <ProductGrid />
        </div>
      </div>
    </div>
  );
}