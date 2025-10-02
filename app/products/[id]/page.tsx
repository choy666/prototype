'use client';

import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';
import { ShoppingCart, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getProductById } from '@/lib/actions/products';
import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import type { Product } from '@/types';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
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
  }, [params.id]);

  const handleAddToCart = async () => {
    if (!product || product.stock <= 0) return;
    
    setIsAddingToCart(true);
    try {
      // Aquí iría la lógica para añadir al carrito
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulación
      toast({
        title: '¡Producto añadido!',
        description: `${product.name} ha sido añadido al carrito`,
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

  const incrementQuantity = () => {
    if (product && quantity < (product.stock || 0)) {
      setQuantity(prev => prev + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const changeImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    notFound();
  }

  const productImages = Array.isArray(product.image) 
  ? product.image 
  : [product.image || '/placeholder-product.jpg'];
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Galería de imágenes */}
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/50">
            <Image
              src={productImages[currentImageIndex]}
              alt={product.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
          {productImages.map((img: string, index: number) => (
              <button
                key={index}
                className={`aspect-square overflow-hidden rounded-md border transition-colors ${
                  currentImageIndex === index ? 'border-2 border-primary' : 'border-muted-foreground/20'
                }`}
                onClick={() => changeImage(index)}
              >
                <Image
                  src={img}
                  alt={`Vista ${index + 1} de ${product.name}`}
                  width={100}
                  height={100}
                  className="h-full w-full object-cover"
                />
              </button>
          ))}
          </div>
        </div>

        {/* Información del producto */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="mt-2 text-muted-foreground">{product.category}</p>
          </div>

          <div>
            <p className="text-3xl font-bold">{formatPrice(Number(product.price))}</p>
            <p className="text-sm text-muted-foreground">
              {product.stock > 0 
                ? `${product.stock} unidades disponibles` 
                : 'Producto agotado'}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-medium">Descripción</h2>
            <p className="text-muted-foreground">
              {product.description || 'No hay descripción disponible para este producto.'}
            </p>
          </div>
          <div className="flex flex-col space-y-4 pt-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={decrementQuantity}
                  disabled={quantity <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={incrementQuantity}
                  disabled={!product.stock || quantity >= product.stock}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                className="flex-1"
                onClick={handleAddToCart}
                disabled={!product.stock || isAddingToCart}
              >
                {isAddingToCart ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Añadiendo...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {product.stock > 0 ? 'Añadir al carrito' : 'Sin stock'}
                  </>
                )}
              </Button>
            </div>
            {product.stock > 0 && (
              <p className="text-sm text-muted-foreground">
                Subtotal: {formatPrice(Number(product.price) * quantity)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}