// components/products/ProductCard.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Product } from '@/lib/schema';
import { formatPrice } from '@/lib/utils';
import { ShoppingCart, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  className?: string;
  isLoading?: boolean;
  onAddToCart?: (productId: string) => void;
}

// Componente Skeleton
export function ProductCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div 
      className={cn(
        'overflow-hidden rounded-lg border bg-card shadow-sm',
        'animate-pulse',
        className
      )}
    >
      <div className="aspect-square bg-muted/50"></div>
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 rounded bg-muted"></div>
        <div className="h-4 w-1/4 rounded bg-muted"></div>
        <div className="h-3 w-full rounded bg-muted"></div>
        <div className="h-3 w-5/6 rounded bg-muted"></div>
        <div className="flex gap-2 pt-2">
          <div className="h-9 flex-1 rounded-md bg-muted"></div>
          <div className="h-9 w-9 rounded-md bg-muted"></div>
        </div>
      </div>
    </div>
  );
}

export function ProductCard({ 
  product, 
  className = '',
  isLoading = false,
  onAddToCart
}: ProductCardProps) {
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCart?.(String(product.id)); // Aseguramos que el ID sea string
  };

  if (isLoading) {
    return <ProductCardSkeleton />;
  }

  return (
    <div className={cn(
      'group relative overflow-hidden rounded-lg border bg-card text-card-foreground',
      'shadow-sm transition-all hover:shadow-md',
      className
    )}>
      {/* Imagen del producto */}
      <div className="aspect-square overflow-hidden">
        <Link href={`/products/${product.id}`} className="block h-full w-full">
          <Image
            src={product.image || '/placeholder-product.jpg'}
            alt={product.name}
            width={400}
            height={400}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
      </div>

      {/* Badge de destacado */}
      {product.destacado && (
        <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
          Destacado
        </span>
      )}

      {/* Contenido de la tarjeta */}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium line-clamp-1">
            <Link href={`/products/${product.id}`} className="hover:underline">
              {product.name}
            </Link>
          </h3>
          <span className="font-bold text-primary">
            {formatPrice(Number(product.price))}
          </span>
        </div>

        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
          {product.description}
        </p>

        <div className="flex items-center justify-between gap-2">
          <Button 
            size="sm" 
            className="w-full"
            onClick={handleAddToCart}
            disabled={product.stock <= 0}
          >
            {product.stock > 0 ? (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Añadir
              </>
            ) : (
              'Sin stock'
            )}
          </Button>
          
          <Button 
            variant="outline" 
            size="icon"
            className="h-9 w-9 shrink-0"
            asChild
          >
            <Link href={`/products/${product.id}`} title="Vista rápida">
              <Eye className="h-4 w-4" />
              <span className="sr-only">Vista rápida</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Estado de stock */}
      {product.stock <= 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <span className="rounded-full bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground">
            Sin stock
          </span>
        </div>
      )}
    </div>
  );
}