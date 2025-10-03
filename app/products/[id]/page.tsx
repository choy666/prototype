// app/products/[id]/page.tsx
'use client';

import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';
import { ShoppingCart, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getProductById } from '@/lib/actions/products';
import { useState, useEffect, useMemo } from 'react';
import { toast } from '@/components/ui/use-toast';
import type { Product, ProductPageProps } from '@/types';

export default function ProductDetailPage({ params: paramsPromise }: ProductPageProps) {
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [params, setParams] = useState<{ id: string } | null>(null);

  // Cargar y desempaquetar los parámetros
  useEffect(() => {
    const loadParams = async () => {
      try {
        const resolvedParams = await paramsPromise;
        if (!resolvedParams?.id) {
          notFound();
          return;
        }
        setParams({ id: resolvedParams.id });
      } catch (error) {
        console.error('Error loading params:', error);
        notFound();
      }
    };

    loadParams();
  }, [paramsPromise]);

  // Cargar el producto cuando los parámetros estén listos
  useEffect(() => {
    if (!params?.id) return;

    const productId = parseInt(params.id, 10);
    if (isNaN(productId)) {
      notFound();
      return;
    }

    const loadProduct = async () => {
      try {
        const productData = await getProductById(productId);
        if (!productData) {
          notFound();
          return;
        }
        setProduct(productData);
      } catch (error) {
        console.error('Error loading product:', error);
        toast({
          title: 'Error',
          description: 'No se pudo cargar el producto',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [params?.id]);

  // Obtener las imágenes del producto
  const productImages = useMemo<string[]>(() => {
    if (!product?.image) return [];
    if (Array.isArray(product.image)) {
      // Si hay más de 3 imágenes, mostramos solo las primeras 3
      return product.image.slice(0, 3);
    }
    // Si solo hay una imagen, la repetimos hasta 3 veces
    return Array(3).fill(product.image);
  }, [product?.image]);

  const handleAddToCart = async () => {
    if (!product) return;

    setIsAddingToCart(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: 'Producto agregado',
        description: `${product.name} ha sido agregado al carrito`,
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        title: 'Error',
        description: 'No se pudo agregar el producto al carrito',
        variant: 'destructive',
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const nextImage = () => {
    if (!productImages.length) return;
    setCurrentImageIndex(prev => 
      prev === productImages.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    if (!productImages.length) return;
    setCurrentImageIndex(prev => 
      prev === 0 ? productImages.length - 1 : prev - 1
    );
  };

  if (isLoading || !params) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!product) {
    notFound();
  }

  const currentImage = productImages[currentImageIndex % productImages.length] || '/placeholder-product.jpg';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Sección de imágenes */}
        <div className="space-y-4">
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

          {/* Miniaturas de imágenes */}
          <div className="grid grid-cols-3 gap-2">
          {productImages.map((img: string, index: number) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all ${
                currentImageIndex % productImages.length === index
                  ? 'border-primary'
                  : 'border-transparent hover:border-gray-300'
              }`}
              aria-label={`Ver imagen ${index + 1}`}
            >
              <Image
                src={img}
                alt={`${product.name} - Vista ${index + 1}`}
                fill
                className="object-cover hover:opacity-90 transition-opacity"
              />
            </button>
            ))}
          </div>
        </div>

        {/* Información del producto */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
          <p className="text-2xl font-semibold text-primary mb-4">
            {formatPrice(parseFloat(product.price))}
          </p>
          
          <p className="text-gray-600 mb-6">{product.description}</p>
          
          <div className="flex items-center space-x-4 mb-6">
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
            
            <Button
              onClick={handleAddToCart}
              disabled={isAddingToCart || product.stock === 0}
              className="flex-1"
            >
              {isAddingToCart ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agregando...
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {product.stock > 0 ? 'Agregar al carrito' : 'Sin stock'}
                </>
              )}
            </Button>
          </div>

          {product.stock > 0 && (
            <p className="text-sm text-green-600 mb-6">
              {product.stock} disponibles
            </p>
          )}

          <div className="border-t pt-6">
            <h2 className="font-semibold mb-2">Categoría</h2>
            <p className="text-gray-600 capitalize">{product.category}</p>
          </div>
        </div>
      </div>
    </div>
  );
}