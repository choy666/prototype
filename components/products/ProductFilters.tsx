'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCategories } from '@/lib/actions/products';
import { ProductFilters as ProductFiltersType } from '@/types';

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
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (updates: Partial<ProductFiltersType>) => {
    const newFilters = { ...localFilters, ...updates };
    setLocalFilters(newFilters);
    onFilterChange(updates);
  };

  const handleCategoryChange = (value: string) => {
    handleFilterChange({ category: value === 'all' ? undefined : value });
  };

  const handleSortChange = (type: 'sortBy' | 'sortOrder', value: string) => {
    handleFilterChange({ [type]: value });
  };

  const resetFilters = () => {
    const resetValues: Partial<ProductFiltersType> = {
      category: undefined,
      minPrice: priceRange.min,
      maxPrice: priceRange.max,
      search: '',
      sortBy: 'name',
      sortOrder: 'asc' as const
    };
    setLocalFilters(resetValues);
    onFilterChange(resetValues);
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
              value={localFilters.category || 'all'}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
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