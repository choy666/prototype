// components/products/ProductDetails.tsx
'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Product } from '@/lib/schema';
import { formatPrice } from '@/lib/utils';
import { ShoppingCart, ArrowLeft, Heart, Share2, Truck, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface ProductDetailsProps {
  product: Product;
  className?: string;
}

export function ProductDetails({ product, className = '' }: ProductDetailsProps) {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = () => {
    // Lógica para añadir al carrito
    toast.success(`${quantity} ${product.name} añadido al carrito`);
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > (product.stock || 10)) return;
    setQuantity(newQuantity);
  };

  const images = product.image ? JSON.parse(product.image) : [product.image || '/placeholder-product.jpg'];

  return (
    <div className={`container mx-auto px-4 py-8 ${className}`}>
      <Button 
        variant="ghost" 
        onClick={() => router.back()}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a productos
      </Button>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Galería de imágenes */}
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
            <Image
              src={images[selectedImage]}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
            {product.destacado && (
              <span className="absolute left-2 top-2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Destacado
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {images.map((img: string, index: number) => (
              <button
                key={index}
                onClick={() => setSelectedImage(index)}
                className={`relative aspect-square overflow-hidden rounded border ${selectedImage === index ? 'ring-2 ring-primary' : ''}`}
              >
                <Image
                  src={img}
                  alt={`${product.name} - Vista ${index + 1}`}
                  fill
                  className="object-cover"
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
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {formatPrice(Number(product.price))}
              </span>
            </div>

            {product.stock > 0 ? (
              <p className="text-sm text-green-600">En stock ({product.stock} disponibles)</p>
            ) : (
              <p className="text-sm text-destructive">Sin stock</p>
            )}
          </div>

          <div className="prose max-w-none">
            <p>{product.description}</p>
          </div>

            {product.stock > 0 ? (
              <p className="text-sm text-green-600">En stock ({product.stock} disponibles)</p>
            ) : (
              <p className="text-sm text-destructive">Sin stock</p>
            )}
          </div>

          <div className="prose max-w-none">
            <p>{product.description}</p>
          </div>

          <div className="flex items-center space-x-4 pt-4">
            <div className="flex items-center border rounded-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuantityChange(quantity - 1)}
                disabled={quantity <= 1}
                className="h-10 w-10 p-0"
              >
                -
              </Button>
              <span className="w-10 text-center">{quantity}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuantityChange(quantity + 1)}
                disabled={quantity >= (product.stock || 1)}
                className="h-10 w-10 p-0"
              >
                +
              </Button>
            </div>

            <Button
              size="lg"
              className="flex-1"
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              Añadir al carrito
            </Button>
          </div>

          <div className="space-y-2 pt-4">
            <div className="flex items-center text-sm text-muted-foreground">
              <Truck className="mr-2 h-4 w-4" />
              <span>Envío gratuito en pedidos superiores a $50.000</span>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Shield className="mr-2 h-4 w-4" />
              <span>Garantía de devolución de 30 días</span>
            </div>
          </div>

          <div className="flex items-center space-x-4 pt-2">
            <Button variant="outline" size="sm">
              <Heart className="mr-2 h-4 w-4" />
              Guardar
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              Compartir
            </Button>
          </div>
        </div>
      </div>
  );
}