'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '@/types';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { getDiscountedPrice } from '@/lib/utils/pricing';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ProductClient({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0);

  // Atributos disponibles de las variantes
  const availableAttributes = useMemo(() => {
    if (!product.variants?.length) return {};

    const attrs: Record<string, Set<string>> = {};
    product.variants.forEach((variant) => {
      Object.entries(variant.attributes).forEach(([key, value]) => {
        if (!attrs[key]) attrs[key] = new Set();
        attrs[key].add(value);
      });
    });

    return Object.fromEntries(
      Object.entries(attrs).map(([key, values]) => [key, Array.from(values)])
    );
  }, [product.variants]);

  // Opciones disponibles para cada atributo basándose en selecciones previas
  const getAvailableOptions = useCallback(
    (attrKey: string) => {
      if (!product.variants?.length) return availableAttributes[attrKey] || [];

      const selectedKeys = Object.keys(selectedAttributes);
      if (selectedKeys.length === 0) return availableAttributes[attrKey] || [];

      // Encontrar variantes que coincidan con las selecciones actuales
      const matchingVariants = product.variants.filter((variant) => {
        return selectedKeys.every((selectedKey) => {
          if (selectedKey === attrKey) return true; // No filtrar por el atributo actual
          return variant.attributes[selectedKey] === selectedAttributes[selectedKey];
        });
      });

      // Extraer valores únicos del atributo objetivo de las variantes coincidentes
      const options = new Set<string>();
      matchingVariants.forEach((variant) => {
        const value = variant.attributes[attrKey];
        if (value) options.add(value);
      });

      return Array.from(options);
    },
    [product.variants, selectedAttributes, availableAttributes]
  );

  // Variante seleccionada
  const selectedVariant = useMemo(() => {
    if (!product.variants?.length || Object.keys(selectedAttributes).length === 0) return null;

    return (
      product.variants.find((variant) =>
        Object.entries(selectedAttributes).every(
          ([key, value]) => variant.attributes[key] === value
        )
      ) || null
    );
  }, [product.variants, selectedAttributes]);

  // Precio actual (de variante o producto)
  const currentPrice = selectedVariant?.price
    ? Number(selectedVariant.price)
    : Number(product.price);

  // Stock actual (de variante o producto)
  const currentStock = selectedVariant?.stock ?? product.stock;

  // Imágenes disponibles incluyendo variantes con tipo
  const allImages = useMemo<{ src: string; type: 'main' | 'secondary' | 'variant' }[]>(() => {
    const images: { src: string; type: 'main' | 'secondary' | 'variant' }[] = [];

    // Imagen principal del producto
    if (product?.image && typeof product.image === 'string') {
      images.push({ src: product.image, type: 'main' });
    }

    // Imágenes secundarias del producto
    if (product?.images && Array.isArray(product.images)) {
      product.images.forEach((img) => images.push({ src: img, type: 'secondary' }));
    }

    // Agregar imágenes de variantes activas
    if (product.variants?.length) {
      const variantImages = product.variants
        .filter((v) => v.isActive && v.image)
        .map((v) => ({ src: v.image!, type: 'variant' as const }))
        .filter((img) => !images.some((existing) => existing.src === img.src)); // Evitar duplicados

      images.push(...variantImages);
    }

    // Si no hay imágenes del producto, usar placeholder
    if (images.length === 0) {
      images.push({ src: '/placeholder-product.jpg', type: 'main' });
    }

    return images;
  }, [product?.image, product?.images, product.variants]);

  // Imagen actual (priorizar variante seleccionada, luego galería)
  const currentImageSrc =
    selectedVariant?.image || allImages[currentImageIndex % allImages.length]?.src;

  // Efecto para actualizar currentImageIndex cuando se selecciona una variante con imagen
  useMemo(() => {
    if (selectedVariant?.image) {
      const variantImageIndex = allImages.findIndex((img) => img.src === selectedVariant.image);
      if (variantImageIndex !== -1) {
        setCurrentImageIndex(variantImageIndex);
      }
    }
  }, [selectedVariant?.image, allImages]);

  // Normalizamos para getDiscountedPrice
  const normalizedProduct = {
    ...product,
    image: Array.isArray(product.image) ? (product.image[0] ?? null) : (product.image ?? null),
    created_at:
      product.created_at instanceof Date ? product.created_at : new Date(product.created_at),
    updated_at:
      product.updated_at instanceof Date ? product.updated_at : new Date(product.updated_at),
  };

  const hasDiscount = (product.discount ?? 0) > 0;
  const finalPrice = getDiscountedPrice(normalizedProduct);

  const nextImage = () => {
    if (!allImages.length) return;
    setCurrentImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    if (!allImages.length) return;
    setCurrentImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const nextThumbnail = () => {
    if (allImages.length <= 4) return;
    setThumbnailStartIndex((prev) => (prev + 4 >= allImages.length ? 0 : prev + 1));
  };

  const prevThumbnail = () => {
    if (allImages.length <= 4) return;
    setThumbnailStartIndex((prev) => (prev === 0 ? Math.max(0, allImages.length - 4) : prev - 1));
  };

  return (
    <div className='container max-w-4xl mx-auto px-8 sm:px-7 py-4 sm:py-6'>
      <div className='grid md:grid-cols-2 gap-4 sm:gap-6 justify-center'>
        {/* Imágenes */}
        <div className='space-y-3 sm:space-y-4 p-5 bg-black rounded-2xl'>
          <div className='relative aspect-square overflow-hidden rounded-lg bg-gray-100'>
            <Image
              src={currentImageSrc}
              alt={product.name}
              fill
              sizes='(max-width: 768px) 100vw, 50vw'
              placeholder='blur'
              blurDataURL='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z'
              className='object-cover'
              priority
              loading='eager'
            />

            {hasDiscount && <DiscountBadge discount={product.discount} />}

            {allImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className='absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full shadow hover:bg-white transition-colors'
                  aria-label='Imagen anterior'
                >
                  <ChevronLeft className='h-5 w-5' />
                </button>
                <button
                  onClick={nextImage}
                  className='absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full shadow hover:bg-white transition-colors'
                  aria-label='Siguiente imagen'
                >
                  <ChevronRight className='h-5 w-5' />
                </button>
              </>
            )}
          </div>

          {/* Miniaturas con carrusel */}
          <div className='relative'>
            {allImages.length > 4 && (
              <>
                <button
                  onClick={prevThumbnail}
                  className='absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 p-1 rounded-full shadow hover:bg-white transition-colors'
                  aria-label='Miniaturas anteriores'
                >
                  <ChevronLeft className='h-4 w-4' />
                </button>
                <button
                  onClick={nextThumbnail}
                  className='absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 p-1 rounded-full shadow hover:bg-white transition-colors'
                  aria-label='Miniaturas siguientes'
                >
                  <ChevronRight className='h-4 w-4' />
                </button>
              </>
            )}
            <div
              className={`grid gap-2 ${allImages.length <= 3 ? 'grid-cols-3' : 'grid-cols-4'} ${allImages.length > 4 ? 'px-8' : ''}`}
            >
              {allImages.slice(thumbnailStartIndex, thumbnailStartIndex + 4).map((img, index) => {
                const absoluteIndex = thumbnailStartIndex + index;
                const isActive = currentImageSrc === img.src;

                return (
                  <button
                    key={absoluteIndex}
                    onClick={() => {
                      // Auto-selección de variante al clic en imagen de variante
                      if (img.type === 'variant') {
                        const variant = product.variants?.find((v) => v.image === img.src);
                        if (variant) {
                          setSelectedAttributes(variant.attributes);
                        }
                      }
                      setCurrentImageIndex(absoluteIndex);
                    }}
                    className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all ${
                      isActive ? 'border-primary' : 'border-transparent hover:border-gray-300'
                    }`}
                    aria-label={`Ver imagen ${absoluteIndex + 1}`}
                    title={`${img.type === 'main' ? 'Imagen principal' : img.type === 'secondary' ? 'Imagen secundaria' : 'Imagen de variante - clic para seleccionar'}`}
                  >
                    <Image
                      src={img.src}
                      alt={`${product.name} - Vista ${absoluteIndex + 1}`}
                      fill
                      sizes='(max-width: 768px) 25vw, 25vw'
                      placeholder='blur'
                      blurDataURL='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z'
                      className='object-cover hover:opacity-90 transition-opacity'
                      loading='lazy'
                    />
                    {/* Indicador visual del tipo de imagen */}
                    <div
                      className={`absolute top-1 right-1 w-3 h-3 rounded-full border border-white ${
                        img.type === 'main'
                          ? 'bg-blue-500'
                          : img.type === 'secondary'
                            ? 'bg-green-500'
                            : 'bg-purple-500 shadow-lg'
                      }`}
                      title={
                        img.type === 'main'
                          ? 'Imagen principal'
                          : img.type === 'secondary'
                            ? 'Imagen secundaria'
                            : 'Imagen de variante - clic para seleccionar'
                      }
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Información del producto */}
        <div className='space-y-4 sm:space-y-6'>
          <h1 className='text-2xl sm:text-3xl font-bold text-white'>{product.name}</h1>

          <div className='text-2xl sm:text-2xl font-semibold text-primary'>
            {hasDiscount ? (
              <div className='flex flex-col'>
                <span className='text-sm text-gray-400 line-through'>
                  {formatPrice(currentPrice)}
                </span>
                <span>{formatPrice(finalPrice)}</span>
              </div>
            ) : (
              <span>{formatPrice(currentPrice)}</span>
            )}
          </div>

          <p className='text-gray-600'>{product.description}</p>

          {/* Selección de variantes */}
          {Object.keys(availableAttributes).length > 0 && (
            <div className='space-y-4'>
              <h3 className='font-semibold text-white'>Opciones disponibles</h3>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                {Object.entries(availableAttributes).map(([attrKey]) => (
                  <div key={attrKey} className='space-y-2'>
                    <label className='text-sm font-medium text-white capitalize'>{attrKey}</label>
                    <Select
                      value={selectedAttributes[attrKey] || ''}
                      onValueChange={(value) =>
                        setSelectedAttributes((prev) => ({
                          ...prev,
                          [attrKey]: value,
                        }))
                      }
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={`Seleccionar ${attrKey}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableOptions(attrKey).map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className='flex items-center space-x-4'>
            <div className='flex items-center border rounded-md'>
              <button
                onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                className='px-3 py-1 text-lg hover:bg-gray-100 transition-colors'
                disabled={quantity <= 1}
              >
                -
              </button>
              <span className='px-4 py-1 border-x'>{quantity}</span>
              <button
                onClick={() => setQuantity((prev) => prev + 1)}
                className='px-3 py-1 text-lg hover:bg-gray-100 transition-colors'
              >
                +
              </button>
            </div>

            <AddToCartButton
              product={{
                id: product.id,
                name: product.name,
                price: currentPrice, // precio de variante o producto
                discount: product.discount, // pasamos descuento al carrito
                image: currentImageSrc, // imagen de variante o producto
                stock: currentStock, // stock de variante o producto
                variantId: selectedVariant?.id, // ID de la variante seleccionada
                variantAttributes: selectedVariant?.attributes, // atributos de la variante
              }}
              quantity={quantity}
              className='flex-1'
            />
          </div>

          <div className='space-y-4'>
            <div>
              <h3 className='font-semibold'>Categoría</h3>
              <p className='text-gray-600 capitalize'>{product.category}</p>
            </div>
            <div>
              <h3 className='font-semibold'>Disponibilidad</h3>
              <p className='text-gray-600'>
                {currentStock > 0 ? `En stock (${currentStock} disponibles)` : 'Sin stock'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
