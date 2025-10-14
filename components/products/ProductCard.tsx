'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Product } from '@/lib/schema';
import { formatPrice } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { getDiscountedPrice } from '@/lib/utils/pricing';
import { ProductCardSkeleton } from './ProductCardSkeleton';

interface ProductCardProps {
  product: Product;
  className?: string;
  isLoading?: boolean;
}

export function ProductCard({
  product,
  className = '',
  isLoading = false,
}: ProductCardProps) {
  if (isLoading) {
    return <ProductCardSkeleton className={className} />;
  }

  const hasDiscount = product.discount && product.discount > 0;
  const finalPrice = getDiscountedPrice(product);

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card text-card-foreground',
        'shadow-sm transition-all hover:shadow-md bg-black',
        className
      )}
    >
      {/* Imagen */}
      <div className="aspect-square overflow-hidden relative">
        <Link href={`/products/${product.id}`} className="block h-full w-full">
          <Image
            src={product.image || '/placeholder-product.jpg'}
            alt={product.name}
            width={400}
            height={400}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 group-hover:brightness-105"
          />
        </Link>

        {hasDiscount && <DiscountBadge discount={product.discount} />}
      </div>

      {/* Contenido */}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold line-clamp-1 text-white">
            <Link href={`/products/${product.id}`} className="hover:underline">
              {product.name}
            </Link>
          </h3>
          <div className="text-right">
            {hasDiscount ? (
              <div className="flex flex-col items-end">
                <span className="text-xs text-muted-foreground line-through text-white">
                  {formatPrice(Number(product.price))}
                </span>
                <span className="text-lg font-bold text-primary">
                  {formatPrice(finalPrice)}
                </span>
              </div>
            ) : (
              <span className="text-lg font-bold text-primary">
                {formatPrice(Number(product.price))}
              </span>
            )}
          </div>
        </div>
      </div>

      {product.stock <= 0 && (
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-background/70">
          <span className="rounded-full bg-destructive px-3 py-1 text-sm font-medium text-white">
            Sin stock
          </span>
        </div>
      )}
    </div>
  );
}