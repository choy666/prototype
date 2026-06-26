'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCategories as getMlCategories } from '@/lib/actions/categories';
import type { Category } from '@/lib/schema';
import type { ProductFilters as ProductFiltersType } from '@/types';

interface ProductFiltersProps {
  filters: ProductFiltersType;
  onFilterChange: (filters: Partial<ProductFiltersType>) => void;
  className?: string;
  priceRange?: {
    min: number;
    max: number;
  };
}

export function ProductFilters({ 
  filters,
  onFilterChange,
  className = '',
  priceRange = { min: 0, max: 1000 } 
}: ProductFiltersProps) {
  const [localFilters, setLocalFilters] = useState<Partial<ProductFiltersType>>(filters);
  const [categories, setCategories] = useState<Category[]>([]);
  const pendingUpdates = useRef<Partial<ProductFiltersType> | null>(null);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getMlCategories();
        const mlLeafCategories = cats.filter(cat => cat.mlCategoryId && cat.isMlOfficial && cat.isLeaf);
        setCategories(mlLeafCategories as Category[]);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Notificar al padre después del render
  useEffect(() => {
    if (pendingUpdates.current) {
      onFilterChange(pendingUpdates.current);
      pendingUpdates.current = null;
    }
  }, [localFilters, onFilterChange]);

  const handleFilterChange = (updates: Partial<ProductFiltersType>) => {
    setLocalFilters(prev => ({ ...prev, ...updates }));
    pendingUpdates.current = updates;
  };

  const handleCategoryChange = (value: string) => {
    if (value === 'all') {
      // "Todas las categorías" → category = undefined
      handleFilterChange({ category: undefined, minDiscount: undefined });
    } else if (value === 'OFERTAS') {
      // Ofertas → sin categoría, pero con minDiscount
      handleFilterChange({ category: undefined, minDiscount: 1 });
    } else {
      handleFilterChange({ category: value, minDiscount: undefined });
    }
  };

  const handleSortChange = (type: 'sortBy' | 'sortOrder', value: string) => {
    handleFilterChange({ [type]: value });
  };

  const resetFilters = () => {
    const resetValues: Partial<ProductFiltersType> = {
      category: undefined, // nunca "all"
      minPrice: priceRange.min,
      maxPrice: priceRange.max,
      search: '',
      sortBy: 'name',
      sortOrder: 'asc',
      minDiscount: undefined,
    };
    setLocalFilters(resetValues);
    pendingUpdates.current = resetValues;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">Filtros</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={resetFilters}
            className="text-xs h-7 px-2"
          >
            Limpiar
          </Button>
        </div>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sortBy" className="text-xs text-muted-foreground mb-1 block">
                Ordenar por
              </Label>
              <Select
                value={localFilters.sortBy || 'name'}
                onValueChange={(value) => handleSortChange('sortBy', value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nombre</SelectItem>
                  <SelectItem value="price">Precio</SelectItem>
                  <SelectItem value="created_at">Recientes</SelectItem>
                  <SelectItem value="discount">Descuento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sortOrder" className="text-xs text-muted-foreground mb-1 block">
                Orden
              </Label>
              <Select
                value={localFilters.sortOrder || 'asc'}
                onValueChange={(value) => handleSortChange('sortOrder', value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascendente</SelectItem>
                  <SelectItem value="desc">Descendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="category" className="text-xs text-muted-foreground mb-1 block">
              Categoría
            </Label>
            <Select
              value={
                localFilters.minDiscount
                  ? 'OFERTAS'
                  : localFilters.category ?? 'all'
              }
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                <SelectItem value="OFERTAS">OFERTAS</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.mlCategoryId!} value={category.mlCategoryId!}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}