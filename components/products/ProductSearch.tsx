'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductSearchProps {
  className?: string;
  placeholder?: string;
  onSearch?: (query: string) => void;
  autoFocus?: boolean;
  showClearButton?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function ProductSearch({
  className = '',
  placeholder = 'Buscar productos...',
  onSearch,
  autoFocus = false,
  showClearButton = true,
  variant = 'outline',
  size = 'default',
}: ProductSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get('search') || ''
  );

  // Actualizar el estado cuando cambian los parámetros de búsqueda
  useEffect(() => {
    const search = searchParams.get('search') || '';
    setSearchQuery(search);
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const performSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
      // Resetear la página cuando se realiza una nueva búsqueda
      params.delete('page');
    } else {
      params.delete('search');
    }

    // Llamar al callback si está definido
    if (onSearch) {
      onSearch(searchQuery.trim());
    }

    // Actualizar la URL sin recargar la página
    router.push(`/products?${params.toString()}`, { scroll: false });
  };

  const handleClear = () => {
    setSearchQuery('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    const params = new URLSearchParams(searchParams.toString());
    params.delete('search');
    
    if (onSearch) {
      onSearch('');
    }
    
    router.push(`/products?${params.toString()}`, { scroll: false });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch();
    }
  };

  return (
    <form 
      onSubmit={handleSearch}
      className={cn('relative w-full max-w-2xl', className)}
    >
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        
        <Input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            'pl-10 pr-10',
            'transition-all duration-200',
            'focus-visible:ring-2 focus-visible:ring-ring',
            variant === 'outline' && 'border-input',
            size === 'sm' ? 'h-9' : size === 'lg' ? 'h-11' : 'h-10'
          )}
        />
        
        {(showClearButton && searchQuery) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {/* Botón de búsqueda para dispositivos móviles */}
      <div className="mt-2 sm:hidden">
        <Button 
          type="submit" 
          size="sm" 
          className="w-full"
        >
          Buscar
        </Button>
      </div>
      
      {/* Sugerencias (puedes implementar esta parte más adelante) */}
      {/* {isFocused && searchQuery && (
        <div className="absolute z-10 mt-1 w-full bg-popover shadow-lg rounded-md border">
          <div className="p-2 text-sm text-muted-foreground">
            Buscando "{searchQuery}"...
          </div>
        </div>
      )} */}
    </form>
  );
}
