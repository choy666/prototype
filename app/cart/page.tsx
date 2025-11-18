'use client';

import { useCartStore, CartItem } from "@/lib/stores/useCartStore";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { getUserCart } from "@/lib/actions/cart";
import { convertAttributesToObject } from "@/lib/utils";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart } = useCartStore();
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.id) {
      getUserCart(Number(session.user.id)).then(cart => {
        if (cart && cart.items.length > 0) {
          // Obtener items actuales del store local
          const currentLocalItems = useCartStore.getState().items;

          // Solo sincronizar desde servidor si hay items locales existentes
          // Si el carrito local está vacío, no restaurar items antiguos (evita restaurar items después de compra exitosa)
          if (currentLocalItems.length > 0 && cart.items.length > currentLocalItems.length) {
            const mappedItems: CartItem[] = cart.items.map(item => ({
              id: item.id,
              name: item.product?.name || 'Producto desconocido',
              variantName: item.variant?.name || undefined,
              price: Number(item.variant?.price || item.product?.price || 0),
              discount: item.product?.discount || 0,
              image: (item.variant?.images as string[] | undefined)?.[0] || item.product?.image || undefined,
              quantity: item.quantity,
              stock: Number(item.variant?.stock || item.product?.stock || 0),
              weight: item.product?.weight ? Number(item.product.weight) : undefined,
              variantId: item.variantId || undefined,
              variantAttributes: item.variant?.additionalAttributes ? (item.variant.additionalAttributes as Record<string, string>) : undefined,
              productAttributes: item.product?.attributes ? (item.product.attributes as Record<string, string>) : undefined,
            }));

            // Fusionar con items locales existentes (priorizando servidor)
            const mergedItems = [...mappedItems];

            // Agregar items locales que no estén en el servidor
            currentLocalItems.forEach(localItem => {
              const existsInServer = mergedItems.some(serverItem =>
                serverItem.id === localItem.id && serverItem.variantId === localItem.variantId
              );
              if (!existsInServer) {
                mergedItems.push(localItem);
              }
            });

            useCartStore.setState({ items: mergedItems });
          }
        }
      }).catch(console.error);
    }
  }, [session]);

  const handleCheckout = () => {
    // Redirigir a la página de checkout en lugar de procesar directamente
    router.push('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className='container mx-auto p-8 text-center'>
        <h1 className='text-3xl font-bold mb-4'>Tu carrito está vacío</h1>
        <p className='mb-6'>¡Explora nuestros productos y encuentra algo que te guste!</p>
        <Link href='/products'>
          <Button>Seguir comprando</Button>
        </Link>
      </div>
    );
  }

  // Calcular total con descuentos
  const total = items.reduce((acc, item) => {
    const basePrice = item.price;
    const finalPrice =
      item.discount && item.discount > 0 ? basePrice * (1 - item.discount / 100) : basePrice;
    return acc + finalPrice * item.quantity;
  }, 0);

  return (
    <div className='container mx-auto p-4 sm:p-6 md:p-8'>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4'>
        <h1 className='text-2xl sm:text-3xl font-bold'>Tu Carrito</h1>
        <Button variant='outline' onClick={clearCart} className='w-full sm:w-auto'>
          Vaciar carrito
        </Button>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8'>
        <div className='lg:col-span-2 space-y-4'>
          {items.map((item, index) => {
            const basePrice = item.price;
            const hasDiscount = item.discount && item.discount > 0;
            const finalPrice = hasDiscount ? basePrice * (1 - item.discount / 100) : basePrice;

            return (
              <div
                key={`${item.id}-${index}`}
                className='flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border rounded-lg'
              >
                <Image
                  src={item.image || '/placeholder-product.jpg'}
                  alt={item.name}
                  width={80}
                  height={80}
                  sizes="(max-width: 640px) 60px, 80px"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                  loading='lazy'
                  className='w-16 h-16 sm:w-20 sm:h-20 object-cover rounded'
                />
                <div className='flex-1 min-w-0'>
                  <h3 className='font-medium text-sm sm:text-base'>{item.variantName || item.name}</h3>
                  {/* Mostrar atributos relevantes: variante si existe, sino producto */}
                  {(() => {
                    const attrs = item.variantId ? convertAttributesToObject(item.variantAttributes) : convertAttributesToObject(item.productAttributes);
                    return Object.keys(attrs).length > 0 ? (
                      <p className='text-xs text-gray-500'>
                        {Object.entries(attrs).map(([key, value]) => `${key}: ${value}`).join(', ')}
                      </p>
                    ) : null;
                  })()}
                  {hasDiscount ? (
                    <div className='flex flex-col'>
                      <span className='text-xs sm:text-sm text-gray-400 line-through'>
                        {formatCurrency(basePrice)}
                      </span>
                      <span className='text-sm sm:text-base text-red-600 font-semibold'>
                        {formatCurrency(finalPrice)}
                      </span>
                    </div>
                  ) : (
                    <p className='text-sm sm:text-base text-gray-600'>{formatCurrency(basePrice)}</p>
                  )}
                </div>
                <div className='flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start'>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='outline'
                      size='icon'
                      aria-label='Disminuir cantidad'
                      onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1), item.variantId)}
                      className='min-h-[44px] min-w-[44px]'
                    >
                      <Minus className='h-4 w-4' />
                    </Button>
                    <span aria-live='polite' className='px-2'>{item.quantity}</span>
                    <Button
                      variant='outline'
                      size='icon'
                      aria-label='Aumentar cantidad'
                      onClick={() => updateQuantity(item.id, item.quantity + 1, item.variantId)}
                      className='min-h-[44px] min-w-[44px]'
                    >
                      <Plus className='h-4 w-4' />
                    </Button>
                  </div>
                  <div className='font-medium text-sm sm:text-base ml-4'>{formatCurrency(finalPrice * item.quantity)}</div>
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label='Eliminar producto'
                    onClick={() => removeItem(item.id, item.variantId)}
                    className='min-h-[44px] min-w-[44px]'
                  >
                    <X className='h-5 w-5' />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className='bg-gray-50 p-4 sm:p-6 rounded-lg h-fit'>
          <h2 className='text-lg sm:text-xl font-bold mb-4'>Resumen del pedido</h2>
          <div className='space-y-4'>
            <div className='flex justify-between text-sm sm:text-base'>
              <span className='text-gray-600'>Subtotal</span>
              <span className='text-gray-600'>{formatCurrency(total)}</span>
            </div>
            <div className='flex justify-between text-sm sm:text-base'>
              <span className='text-gray-600'>Envío</span>
              <span className='text-gray-600'>{formatCurrency(0)}</span>
            </div>
            <div className='flex justify-between font-bold text-base sm:text-lg border-t pt-4'>
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>

            <Button onClick={handleCheckout} className='w-full min-h-[44px]'>
              Proceder al Checkout
            </Button>

            <div className='space-y-4'>
              <div className='text-gray-600 text-center text-sm'>
                <Link href='/products' className='hover:underline'>
                  continuar comprando
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
