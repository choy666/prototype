'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCategories } from '@/lib/actions/products';

interface ProductFiltersProps {
  className?: string;
  initialFilters?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  priceRange?: {
    min: number;
    max: number;
  };
}

type FilterState = {
  category: string;
  minPrice: number;
  maxPrice: number;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

export function ProductFilters({ 
  className = '',
  initialFilters = {},
  priceRange = { min: 0, max: 1000 } 
}: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [filters, setFilters] = useState<FilterState>({
    category: searchParams.get('category') || '',
    minPrice: searchParams.get('minPrice') 
      ? Number(searchParams.get('minPrice')) 
      : priceRange.min,
    maxPrice: searchParams.get('maxPrice') 
      ? Number(searchParams.get('maxPrice')) 
      : priceRange.max,
    search: searchParams.get('search') || '',
    sortBy: searchParams.get('sortBy') || 'created_at',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    ...initialFilters
  });

  // Estado para las categorías
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar categorías al montar el componente
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (error) {
        console.error('Error loading categories:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, []);

  // Actualizar la URL cuando cambian los filtros
// Actualizar la firma de la función updateUrl
const updateUrl = (newFilters: Partial<FilterState>) => {
    const params = new URLSearchParams();
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });
  
    router.push(`/products?${params.toString()}`, { scroll: false });
  };

  // Manejadores de cambio
  const handleCategoryChange = (value: string) => {
    const newFilters = { ...filters, category: value };
    setFilters(newFilters);
    updateUrl(newFilters);
  };

  const handlePriceChange = (values: number[]) => {
    const [min, max] = values;
    const newFilters = { ...filters, minPrice: min, maxPrice: max };
    setFilters(newFilters);
    updateUrl(newFilters);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, search: e.target.value });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl(filters);
  };

  const handleSortChange = (value: string) => {
    const [sortBy, sortOrder] = value.split('_');
    const newFilters = { ...filters, sortBy, sortOrder: sortOrder as 'asc' | 'desc' };
    setFilters(newFilters);
    updateUrl(newFilters);
  };

  // Resetear filtros
  const resetFilters = () => {
    const newFilters = {
      category: '',
      minPrice: priceRange.min,
      maxPrice: priceRange.max,
      search: '',
      sortBy: 'created_at',
      sortOrder: 'desc' as const,
    };
    setFilters(newFilters);
    updateUrl(newFilters);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Título */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Filtros</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={resetFilters}
          className="text-xs"
        >
          Limpiar filtros
        </Button>
      </div>

      {/* Buscador */}
      <div className="space-y-2">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <Input
            placeholder="Buscar productos..."
            value={filters.search}
            onChange={handleSearchChange}
            className="flex-1"
          />
          <Button type="submit" size="sm">
            Buscar
          </Button>
        </form>
      </div>

      {/* Ordenar por */}
      <div className="space-y-2">
        <Label>Ordenar por</Label>
        <Select
          value={`${filters.sortBy}_${filters.sortOrder}`}
          onValueChange={handleSortChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar orden" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Nombre (A-Z)</SelectItem>
            <SelectItem value="name_desc">Nombre (Z-A)</SelectItem>
            <SelectItem value="price_asc">Precio: Menor a mayor</SelectItem>
            <SelectItem value="price_desc">Precio: Mayor a menor</SelectItem>
            <SelectItem value="created_at_desc">Más recientes</SelectItem>
            <SelectItem value="created_at_asc">Más antiguos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Categorías */}
      <div className="space-y-2">
        <Label>Categorías</Label>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              variant={!filters.category ? 'default' : 'outline'}
              size="sm"
              className="w-full justify-start"
              onClick={() => handleCategoryChange('')}
            >
              Todas las categorías
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={filters.category === category ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start capitalize"
                onClick={() => handleCategoryChange(category)}
              >
                {category.toLowerCase()}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Rango de precios */}
      <div className="space-y-4">
        <div className="flex justify-between">
          <Label>Rango de precios</Label>
          <span className="text-sm text-muted-foreground">
            ${filters.minPrice} - ${filters.maxPrice}
          </span>
        </div>
        <Slider
          min={priceRange.min}
          max={priceRange.max}
          step={10}
          value={[filters.minPrice, filters.maxPrice]}
          onValueChange={handlePriceChange}
          minStepsBetweenThumbs={1}
          className="py-4"
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>${priceRange.min}</span>
          <span>${priceRange.max}</span>
        </div>
      </div>
    </div>
  );
}
