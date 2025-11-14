'use client';

import { useState, useMemo, useEffect } from 'react';
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
import {
  Collapsible,
} from '@/components/ui/Collapsible';

// Función helper para normalizar atributos
const normalizeAttributes = (attributes: unknown): Record<string, string> => {
  if (!attributes) return {};

  // Si ya es un objeto plano Record<string, string>
  if (typeof attributes === 'object' && !Array.isArray(attributes)) {
    return attributes as Record<string, string>;
  }

  // Si es un array de objetos {name, values}
  if (Array.isArray(attributes)) {
    const normalized: Record<string, string> = {};
    attributes.forEach((attr: unknown) => {
      if (attr && typeof attr === 'object' && 'name' in attr && 'values' in attr) {
        const attrObj = attr as { name: string; values: string[] };
        if (attrObj.name && Array.isArray(attrObj.values) && attrObj.values.length > 0) {
          normalized[attrObj.name] = attrObj.values.join(', ');
        }
      }
    });
    return normalized;
  }

  return {};
};

export default function ProductClient({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0);
  const [useOriginalProduct, setUseOriginalProduct] = useState(true); // Estado para alternar entre original y variantes
const [selectedVariantName, setSelectedVariantName] = useState<string>(''); // Estado para la variante seleccionada por nombre
  const [isLoadingVariant, setIsLoadingVariant] = useState(false); // Loading state para cambio de variante

  const hasActiveVariants = product.variants?.some(v => v.isActive) ?? false;

  // Atributos disponibles de las variantes (comentado para evitar warning de unused)
  // const availableAttributes = useMemo(() => {
  //   if (!product.variants?.length) return {};

  //   const attrs: Record<string, Set<string>> = {};
  //   product.variants.filter(v => v.isActive).forEach((variant) => {
  //     if (variant.attributes) {
  //       Object.entries(variant.attributes).forEach(([key, value]) => {
  //         if (!attrs[key]) attrs[key] = new Set();
  //         attrs[key].add(value);
  //       });
  //     }
  //   });

  //   return Object.fromEntries(
  //     Object.entries(attrs).map(([key, values]) => [key, Array.from(values)])
  //   );
  // }, [product.variants]);



  // Variante seleccionada
  const selectedVariant = useMemo(() => {
    // Si useOriginalProduct es true, retornar null (producto base)
    if (useOriginalProduct) {
      return null;
    }

    if (!product.variants?.length || !selectedVariantName) return null;

    return product.variants.find((variant) => variant.name === selectedVariantName) || null;
  }, [product.variants, selectedVariantName, useOriginalProduct]);

  // Efecto para manejar loading al cambiar variante
  useEffect(() => {
    if (selectedVariantName) {
      setIsLoadingVariant(true);
      // Simular breve delay para mostrar loading (puede ajustarse o removerse si no es necesario)
      const timer = setTimeout(() => {
        setIsLoadingVariant(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedVariantName]);

  // Nombre de la variante seleccionada para mostrar (comentado para evitar warning)
  // const selectedVariantName = useMemo(() => {
  //   if (!selectedVariant) return null;
  //   return selectedVariant.name || Object.entries(selectedVariant.attributes)
  //     .map(([key, value]) => `${key}: ${value}`)
  //     .join(", ");
  // }, [selectedVariant]);

  // Precio actual (de variante o producto)
  const currentPrice = selectedVariant?.price
    ? Number(selectedVariant.price)
    : Number(product.price);

  // Stock actual (de variante o producto)
  const currentStock = selectedVariant?.stock ?? product.stock;

  // Imágenes disponibles: si hay variante seleccionada, usar solo las de la variante; de lo contrario, las del producto
  const allImages = useMemo<{ src: string; type: 'main' | 'secondary' | 'variant' }[]>(() => {
    const images: { src: string; type: 'main' | 'secondary' | 'variant' }[] = [];

    if (!useOriginalProduct && selectedVariant && selectedVariant.images && Array.isArray(selectedVariant.images) && selectedVariant.images.length > 0) {
      // Usar solo imágenes de la variante seleccionada
      selectedVariant.images.forEach((img) => images.push({ src: img, type: 'variant' }));
    } else {
      // Usar imágenes del producto original
      if (product?.image && typeof product.image === 'string') {
        images.push({ src: product.image, type: 'main' });
      }

      if (product?.images && Array.isArray(product.images)) {
        product.images.forEach((img) => images.push({ src: img, type: 'secondary' }));
      }
    }

    // Si no hay imágenes, usar placeholder
    if (images.length === 0) {
      images.push({ src: '/placeholder-product.jpg', type: 'main' });
    }

    return images;
  }, [product?.image, product?.images, useOriginalProduct, selectedVariant]);

  // Imagen actual basada en el índice actual de allImages
  const currentImageSrc = allImages[currentImageIndex % allImages.length]?.src || '/placeholder-product.jpg';

  // Primera imagen del producto o variante para el carrito
  const firstImageSrc = useMemo(() => {
    if (!useOriginalProduct && selectedVariant && selectedVariant.images && Array.isArray(selectedVariant.images) && selectedVariant.images.length > 0) {
      return selectedVariant.images[0];
    } else {
      return product?.image && typeof product.image === 'string' ? product.image : '/placeholder-product.jpg';
    }
  }, [product?.image, useOriginalProduct, selectedVariant]);

  // Efecto para actualizar currentImageIndex cuando se selecciona una variante con imagen
  useEffect(() => {
    if (selectedVariant?.images && selectedVariant.images.length > 0) {
      const variantImageIndex = allImages.findIndex((img) => img.src === selectedVariant.images![0]);
      if (variantImageIndex !== -1) {
        setCurrentImageIndex(variantImageIndex);
      }
    }
  }, [selectedVariant?.images, allImages]);

  // Efecto para resetear índices cuando cambia la selección entre original y variantes
  useEffect(() => {
    setCurrentImageIndex(0);
    setThumbnailStartIndex(0);
  }, [useOriginalProduct, selectedVariantName]);

  // Efecto para sincronizar selects cuando cambia selectedAttributes (para forzar actualización visual)
  useEffect(() => {
    // Esto asegura que los Selects se actualicen cuando selectedAttributes cambia desde imagen click
  }, [selectedAttributes]);

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
  // Calcular precio final aplicando descuento al precio actual (variante o base)
  const finalPrice = hasDiscount ? getDiscountedPrice({ ...normalizedProduct, price: currentPrice }) : currentPrice;

  const nextThumbnail = () => {
    if (allImages.length <= 4) return;

    if (selectedVariant && selectedVariant.images && selectedVariant.images.length > 1) {
      // Navegar por miniaturas centradas en imágenes de variante
      const variantImageIndices = allImages
        .map((img, index) => img.type === 'variant' ? index : -1)
        .filter(i => i !== -1);

      if (variantImageIndices.length > 4) {
        // Si hay más de 4 imágenes de variante, navegar por ellas
        const currentEndIndex = thumbnailStartIndex + 4;
        const lastVariantIndex = variantImageIndices[variantImageIndices.length - 1];

        if (currentEndIndex <= lastVariantIndex) {
          // Aún hay más imágenes de variante para mostrar
          setThumbnailStartIndex((prev) => prev + 1);
        } else {
          // Volver al inicio de las imágenes de variante
          const firstVariantIndex = variantImageIndices[0];
          setThumbnailStartIndex(firstVariantIndex);
        }
        return;
      }
    }

    // Navegación normal por todas las miniaturas
    setThumbnailStartIndex((prev) => (prev + 4 >= allImages.length ? 0 : prev + 1));
  };

  const prevThumbnail = () => {
    if (allImages.length <= 4) return;

    if (selectedVariant && selectedVariant.images && selectedVariant.images.length > 1) {
      // Navegar por miniaturas centradas en imágenes de variante
      const variantImageIndices = allImages
        .map((img, index) => img.type === 'variant' ? index : -1)
        .filter(i => i !== -1);

      if (variantImageIndices.length > 4) {
        // Si hay más de 4 imágenes de variante, navegar por ellas
        const firstVariantIndex = variantImageIndices[0];

        if (thumbnailStartIndex > firstVariantIndex) {
          // Aún hay imágenes de variante anteriores para mostrar
          setThumbnailStartIndex((prev) => prev - 1);
        } else {
          // Ir al final de las imágenes de variante
          const lastVariantIndex = variantImageIndices[variantImageIndices.length - 1];
          setThumbnailStartIndex(Math.max(0, lastVariantIndex - 3));
        }
        return;
      }
    }

    // Navegación normal por todas las miniaturas
    setThumbnailStartIndex((prev) => (prev === 0 ? Math.max(0, allImages.length - 4) : prev - 1));
  };

  const nextImage = () => {
    if (!allImages.length) return;

    if (selectedVariant && selectedVariant.images && selectedVariant.images.length > 1) {
      // Navegar solo por imágenes de variante
      const variantImageIndices = allImages
        .map((img, index) => img.type === 'variant' ? index : -1)
        .filter(i => i !== -1);

      if (variantImageIndices.length > 1) {
        const currentVariantIndex = variantImageIndices.indexOf(currentImageIndex);
        const nextVariantIndex = currentVariantIndex === variantImageIndices.length - 1 ? 0 : currentVariantIndex + 1;
        setCurrentImageIndex(variantImageIndices[nextVariantIndex]);
        return;
      }
    }

    // Navegación normal por todas las imágenes
    setCurrentImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    if (!allImages.length) return;

    if (selectedVariant && selectedVariant.images && selectedVariant.images.length > 1) {
      // Navegar solo por imágenes de variante
      const variantImageIndices = allImages
        .map((img, index) => img.type === 'variant' ? index : -1)
        .filter(i => i !== -1);

      if (variantImageIndices.length > 1) {
        const currentVariantIndex = variantImageIndices.indexOf(currentImageIndex);
        const prevVariantIndex = currentVariantIndex === 0 ? variantImageIndices.length - 1 : currentVariantIndex - 1;
        setCurrentImageIndex(variantImageIndices[prevVariantIndex]);
        return;
      }
    }

    // Navegación normal por todas las imágenes
    setCurrentImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  return (
    <div className='container max-w-4xl mx-auto px-8 sm:px-7 py-4 sm:py-6'>
      <div className='grid md:grid-cols-2 gap-4 sm:gap-6 justify-center'>
        {/* Imágenes */}
        <div className='space-y-3 sm:space-y-4 p-5 bg-black rounded-2xl h-fit'>
          <div className='relative aspect-square overflow-hidden rounded-lg bg-gray-100'>
            {isLoadingVariant && (
              <div className='absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90'>
                <div className='w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin'></div>
              </div>
            )}
            <Image
              src={currentImageSrc}
              alt={product.name}
              fill
              sizes='(max-width: 768px) 100vw, 50vw'
              placeholder='blur'
              blurDataURL='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z'
              className={`object-cover ${isLoadingVariant ? 'opacity-50' : ''}`}
              priority
              loading='eager'
            />

            {hasDiscount && <DiscountBadge discount={product.discount} />}

            {allImages.length > 1 && !isLoadingVariant && (
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
                        const variant = product.variants?.find((v) => v.images && v.images.includes(img.src));
                        if (variant && variant.additionalAttributes) {
                          // Cambiar a modo variantes y seleccionar atributos
                          setUseOriginalProduct(false);
                          setSelectedVariantName(variant.name);
                          // Pequeño delay para asegurar que los selects se actualicen
                          setTimeout(() => {
                            // Confirmar que selectedAttributes se ha actualizado
                          }, 0);
                        }
                      }
                      setCurrentImageIndex(absoluteIndex);
                    }}
                    className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all ${
                      isActive ? 'border-primary' : 'border-transparent hover:border-gray-300'
                    }`}
                    aria-label={`Ver imagen ${absoluteIndex + 1}`}
                    title={`${img.type === 'main' ? 'Imagen principal' : img.type === 'secondary' ? 'Imagen secundaria' : 'Imagen de variante - clic para seleccionar variante'}`}
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
          <h1 className='text-2xl sm:text-3xl font-bold text-white'>
            {selectedVariant?.name || product.name}
          </h1>

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

          <p className='text-gray-600'>
            {selectedVariant?.description || product.description}
          </p>

          {/* Características del producto o variante */}
          {(() => {
            const attrsToUse = selectedVariant?.additionalAttributes || product.attributes;
            const normalizedAttrs = normalizeAttributes(attrsToUse);
            const title = selectedVariant ? "Características de la variante" : "Características del producto";
            return normalizedAttrs && Object.keys(normalizedAttrs).length > 0 && (
              <Collapsible
                title={title}
                defaultOpen={false}
                className="bg-black/20 rounded-xl border border-gray-700"
                headerClassName="p-4"
                contentClassName="p-4 space-y-2"
              >
                <dl className={`grid gap-2 ${Object.keys(normalizedAttrs).length > 4 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                  {Object.entries(normalizedAttrs).map(([key, value]) => (
                    <div key={key} className='flex flex-col'>
                      <dt className='font-medium text-white text-xs capitalize'>{key.replace(/_/g, ' ')}</dt>
                      <dd className='text-gray-400 text-sm'>{value}</dd>
                    </div>
                  ))}
                </dl>
              </Collapsible>
            );
          })()}

          {/* Toggle entre Producto Original y Variantes */}
          {hasActiveVariants && (
            <div className='space-y-4'>
              <h3 className='font-semibold text-white'>Selección de producto</h3>
              <div className='flex gap-2'>
                <button
                  onClick={() => {
                    setUseOriginalProduct(true);
                    setSelectedAttributes({});
                    setCurrentImageIndex(0);
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    useOriginalProduct
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Producto Original
                </button>
                <button
                  onClick={() => {
                    setUseOriginalProduct(false);
                    setSelectedVariantName(''); // Resetear selección de variante
                    setCurrentImageIndex(0);
                    setThumbnailStartIndex(0);
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    !useOriginalProduct
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Variantes
                </button>
              </div>

              {/* Selección de variante por nombre solo si no es producto original */}
              {!useOriginalProduct && (
                <div className='space-y-4'>
                  <h4 className='font-medium text-white'>Seleccionar opciones</h4>
                  <div className='space-y-2'>
                    <label className='text-sm font-medium text-white'>Variante</label>
                    <Select
                      value={selectedVariantName}
                      onValueChange={(value) => {
                        setSelectedVariantName(value);
                      }}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder="Seleccionar variante" />
                      </SelectTrigger>
                      <SelectContent>
                        {product.variants?.filter(v => v.isActive).map((variant) => (
                          <SelectItem key={variant.id} value={variant.name}>
                            {variant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
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
                name: selectedVariant?.name || product.name,
                price: currentPrice, // precio de variante o producto
                discount: product.discount, // pasamos descuento al carrito
                image: firstImageSrc, // primera imagen del producto o variante para el carrito
                stock: currentStock, // stock de variante o producto
                variantId: selectedVariant?.id, // ID de la variante seleccionada
                variantAttributes: selectedVariant?.additionalAttributes, // atributos de la variante
                variantName: selectedVariant?.name,
                productAttributes: product.attributes, // atributos del producto base
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
