"use client";

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '@/types';
import { AddToCartButton } from '@/components/cart/AddToCartButton';

export default function ProductClient({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const productImages = useMemo<string[]>(() => {
    if (!product?.image) return ['/placeholder-product.jpg'];
    return Array.isArray(product.image) ? product.image.slice(0, 3) : [product.image];
  }, [product?.image]);

  const price = useMemo(() => Number(product.price), [product.price]);
  const currentImage = productImages[currentImageIndex % productImages.length];

  const nextImage = () => {
    if (!productImages.length) return;
    setCurrentImageIndex(prev => (prev === productImages.length - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    if (!productImages.length) return;
    setCurrentImageIndex(prev => (prev === 0 ? productImages.length - 1 : prev - 1));
  };

  return (
    <div className="container max-w-4xl mx-auto px-8 sm:px-7 py-4 sm:py-6">
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6 justify-center">
        {/* Imágenes */}
        <div className="space-y-3 sm:space-y-4 p-5 bg-black rounded-2xl">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
            <Image
              src={currentImage}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
            {productImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full shadow hover:bg-white transition-colors"
                  aria-label="Imagen anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full shadow hover:bg-white transition-colors"
                  aria-label="Siguiente imagen"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Miniaturas */}
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, index) => {
              const imgIndex = index % productImages.length;
              const img = productImages[imgIndex];
              const isActive = currentImageIndex % productImages.length === imgIndex;

              return (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(imgIndex)}
                  className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all ${
                    isActive
                      ? 'border-primary'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                  aria-label={`Ver imagen ${imgIndex + 1}`}
                >
                  <Image
                    src={img}
                    alt={`${product.name} - Vista ${imgIndex + 1}`}
                    fill
                    className="object-cover hover:opacity-90 transition-opacity"
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Información del producto */}
        <div className="space-y-4 sm:space-y-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{product.name}</h1>
          <p className="text-2xl sm:text-2xl font-semibold text-primary">
            {formatPrice(price)}
          </p>

          <p className="text-gray-600">{product.description}</p>

          <div className="flex items-center space-x-4">
            <div className="flex items-center border rounded-md">
              <button
                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                className="px-3 py-1 text-lg hover:bg-gray-100 transition-colors"
                disabled={quantity <= 1}
              >
                -
              </button>
              <span className="px-4 py-1 border-x">{quantity}</span>
              <button
                onClick={() => setQuantity(prev => prev + 1)}
                className="px-3 py-1 text-lg hover:bg-gray-100 transition-colors"
              >
                +
              </button>
            </div>

            <AddToCartButton
              product={{
                id: String(product.id),
                name: product.name,
                price: price,
                image: productImages[0] || '/placeholder-product.jpg',
                stock: product.stock
              }}
              quantity={quantity}
              className="flex-1"
            />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Categoría</h3>
              <p className="text-gray-600 capitalize">{product.category}</p>
            </div>
            <div>
              <h3 className="font-semibold">Disponibilidad</h3>
              <p className="text-gray-600">
                {product.stock > 0
                  ? `En stock (${product.stock} disponibles)`
                  : 'Sin stock'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}