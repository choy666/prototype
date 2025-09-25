'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCategories } from '@/lib/actions/products';
import { ProductFilters as ProductFiltersType } from '@/hooks/useProducts';

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

  // Cargar categorías al montar el componente
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

  // Sincronizar los filtros locales cuando cambien los props
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Manejadores de cambio
  const handleFilterChange = (updates: Partial<ProductFiltersType>) => {
    const newFilters = { ...localFilters, ...updates };
    setLocalFilters(newFilters);
    onFilterChange(updates);
  };

  const handlePriceChange = (value: number[]) => {
    handleFilterChange({
      minPrice: value[0],
      maxPrice: value[1]
    });
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilterChange({ search: e.target.value });
  };

  const handleCategoryChange = (value: string) => {
    handleFilterChange({ category: value === 'all' ? undefined : value });
  };

  const handleSortByChange = (value: 'name' | 'price' | 'category' | 'created_at' | 'updated_at' | 'stock') => {
    handleFilterChange({ sortBy: value });
  };

  const handleSortOrderChange = (value: string) => {
    handleFilterChange({ sortOrder: value as 'asc' | 'desc' });
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
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-medium mb-4">Filtros</h3>
        
        {/* Búsqueda */}
        <div className="mb-4">
          <Label htmlFor="search">Buscar</Label>
          <Input
            id="search"
            placeholder="Buscar productos..."
            value={localFilters.search || ''}
            onChange={handleSearch}
            className="w-full"
          />
        </div>

        {/* Categorías */}
        <div className="mb-4">
          <Label htmlFor="category">Categoría</Label>
          <Select
            value={localFilters.category || 'all'}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger className="w-full">
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

        {/* Rango de precios */}
        <div className="mb-4">
          <Label>
            Rango de precios: ${localFilters.minPrice || priceRange.min} - $
            {localFilters.maxPrice || priceRange.max}
          </Label>
          <Slider
            value={[localFilters.minPrice || priceRange.min, localFilters.maxPrice || priceRange.max]}
            min={priceRange.min}
            max={priceRange.max}
            step={1}
            onValueChange={handlePriceChange}
            className="my-4"
          />
        </div>

        {/* Ordenar por */}
        <div className="mb-4">
          <Label htmlFor="sortBy">Ordenar por</Label>
          <Select
            value={localFilters.sortBy || 'name'}
            onValueChange={handleSortByChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nombre</SelectItem>
              <SelectItem value="price">Precio</SelectItem>
              <SelectItem value="created_at">Más recientes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Dirección del orden */}
        <div className="mb-6">
          <Label htmlFor="sortOrder">Orden</Label>
          <Select
            value={localFilters.sortOrder || 'asc'}
            onValueChange={handleSortOrderChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascendente (A-Z, Menor a mayor)</SelectItem>
              <SelectItem value="desc">Descendente (Z-A, Mayor a menor)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          variant="outline" 
          className="w-full"
          onClick={resetFilters}
        >
          Limpiar filtros
        </Button>
      </div>
    </div>
  );
}