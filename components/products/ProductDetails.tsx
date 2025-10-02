'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Product, Review, User } from '@/types';
import { formatPrice } from '@/lib/utils';
import { ShoppingCart, ArrowLeft, Heart, Share2, Truck, Shield, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ProductReviews } from './ProductReviews';
import { useSession } from 'next-auth/react';

interface ProductDetailsProps {
  product: Product & {
    reviews?: Review[];
    averageRating?: number;
    reviewCount?: number;
  };
  className?: string;
}

export function ProductDetails({ product: initialProduct, className = '' }: ProductDetailsProps) {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const { data: session } = useSession();
  
  // Estado local para el producto
  const [productData, setProductData] = useState<Product & {
    reviews?: Review[];
    averageRating?: number;
    reviewCount?: number;
  }>(initialProduct);

  const handleAddToCart = () => {
    // Lógica para añadir al carrito
    toast.success(`${quantity} ${productData.name} añadido al carrito`);
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > (productData.stock || 10)) return;
    setQuantity(newQuantity);
  };

  const handleReviewSubmit = async (reviewData: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch(`/api/products/${productData.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: reviewData.rating,
          comment: reviewData.comment,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al enviar la reseña');
      }
  
      // Actualizar las reseñas después de enviar una nueva
      await fetchProductReviews();
      toast.success('¡Reseña enviada con éxito!');
    } catch (error) {
      console.error('Error al enviar la reseña:', error);
      toast.error(error instanceof Error ? error.message : 'Error al enviar la reseña');
    }
  };

  // Función para cargar las reseñas
  const fetchProductReviews = async () => {
    try {
      const response = await fetch(`/api/products/${productData.id}/reviews`);
      if (!response.ok) throw new Error('Error al cargar las reseñas');
      const data = await response.json();
      setProductData(prev => ({
        ...prev,
        reviews: data.reviews,
        averageRating: data.averageRating,
        reviewCount: data.reviewCount,
      }));
    } catch (error) {
      console.error('Error al cargar las reseñas:', error);
    }
  };

  // Llamar a fetchProductReviews en el efecto
  useEffect(() => {
    if (productData.id) {
      fetchProductReviews();
    }
  }, [productData.id]);

  const images = productData.image ? JSON.parse(productData.image) : [productData.image || '/placeholder-product.jpg'];

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
              src={images[selectedImage] || '/placeholder-product.jpg'}
              alt={productData.name}
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {images.map((image: string, index: number) => (
              <button
                key={index}
                onClick={() => setSelectedImage(index)}
                className={`relative aspect-square overflow-hidden rounded-md border ${
                  selectedImage === index ? 'ring-2 ring-primary' : ''
                }`}
              >
                <Image
                  src={image}
                  alt={`${productData.name} - Vista ${index + 1}`}
                  fill
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">{productData.name}</h1>
          
          {productData.averageRating !== undefined && (
            <div className="mt-2 flex items-center">
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= Math.round(productData.averageRating || 0)
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="ml-2 text-sm text-muted-foreground">
                {productData.reviewCount} {productData.reviewCount === 1 ? 'reseña' : 'reseñas'}
              </span>
            </div>
          )}
          
          <p className="mt-4 text-3xl font-bold">{formatPrice(Number(productData.price))}</p>
          
          <p className="mt-6 text-gray-700 dark:text-gray-300">
            {productData.description || 'No hay descripción disponible para este producto.'}
          </p>
          
          <div className="mt-6 space-y-4">
            <div className="flex items-center">
              <Truck className="h-5 w-5 text-muted-foreground mr-2" />
              <span className="text-sm">
                Envío gratuito en pedidos superiores a $50.000
              </span>
            </div>
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-muted-foreground mr-2" />
              <span className="text-sm">
                Garantía de devolución de 30 días
              </span>
            </div>
          </div>
          
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <div className="flex items-center border rounded-md">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleQuantityChange(quantity - 1)}
                disabled={quantity <= 1}
              >
                -
              </Button>
              <span className="w-10 text-center">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleQuantityChange(quantity + 1)}
                disabled={quantity >= (productData.stock || 10)}
              >
                +
              </Button>
            </div>
            <Button
              onClick={handleAddToCart}
              className="flex-1"
              disabled={!productData.stock}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {productData.stock ? 'Añadir al carrito' : 'Sin stock'}
            </Button>
          </div>
          
          <div className="mt-6 flex gap-4">
            <Button variant="outline" size="icon">
              <Heart className="h-5 w-5" />
              <span className="sr-only">Añadir a favoritos</span>
            </Button>
            <Button variant="outline" size="icon">
              <Share2 className="h-5 w-5" />
              <span className="sr-only">Compartir</span>
            </Button>
          </div>
        </div>
      </div>

      <ProductReviews 
        productId={productData.id}
        reviews={productData.reviews || []}
        user={session?.user as User | null}
        onReviewSubmit={handleReviewSubmit}
      />
    </div>
  );
}