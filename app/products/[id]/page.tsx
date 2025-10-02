import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';
import { ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { getProductById } from '@/lib/actions/products';

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const productId = parseInt(params.id);
  if (isNaN(productId)) {
    notFound();
  }

  const product = await getProductById(productId);

  if (!product) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Galería de imágenes */}
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/50">
            <Image
              src={product.image || '/placeholder-product.jpg'}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-md border">
                <Image
                  src={product.image || '/placeholder-product.jpg'}
                  alt={`Vista ${i} de ${product.name}`}
                  width={100}
                  height={100}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Información del producto */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            {product.destacado && (
              <span className="mt-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                Destacado
              </span>
            )}
          </div>

          <div className="text-3xl font-bold">
            {formatPrice(parseFloat(product.price))}
          </div>

          {product.description && (
            <p className="text-muted-foreground">
              {product.description}
            </p>
          )}

          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center rounded-md border">
                <button 
                  className="px-3 py-2 disabled:opacity-50"
                  disabled={product.stock <= 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="w-10 text-center">1</span>
                <button 
                  className="px-3 py-2 disabled:opacity-50"
                  disabled={product.stock <= 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <Button 
                size="lg" 
                className="flex-1" 
                disabled={product.stock <= 0}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {product.stock > 0 ? 'Añadir al carrito' : 'Sin stock'}
              </Button>
            </div>
            {product.stock > 0 && (
              <p className="text-sm text-muted-foreground">
                {product.stock} {product.stock === 1 ? 'unidad' : 'unidades'} disponible
                {product.stock !== 1 && 's'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}