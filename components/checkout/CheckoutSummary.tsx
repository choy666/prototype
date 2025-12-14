'use client';

import { useCartStore } from "@/lib/stores/useCartStore";
import Link from "next/link";
import Image from "next/image";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

interface CheckoutSummaryProps {
  selectedShippingMethod?: {
    id: string;
    name: string;
    cost: number;
  } | null;
  shippingAddress?: {
    codigoPostal: string;
    provincia: string;
  } | null;
}

export function CheckoutSummary({ selectedShippingMethod, shippingAddress }: CheckoutSummaryProps) {
  const { items } = useCartStore();

  // Calcular total con descuentos
  const subtotal = items.reduce((acc, item) => {
    const basePrice = item.price;
    const finalPrice =
      item.discount && item.discount > 0 ? basePrice * (1 - item.discount / 100) : basePrice;
    return acc + finalPrice * item.quantity;
  }, 0);

  // Usar el costo del método de envío seleccionado (ya calculado por API ML)
  const shippingCost = selectedShippingMethod ? selectedShippingMethod.cost : null;

  const total = subtotal + (shippingCost ?? 0);

  return (
    <div className="bg-gray-50 p-4 sm:p-6 rounded-lg h-fit">
      <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">Resumen del Pedido</h2>

      {/* Lista de productos */}
      <div className="space-y-4 mb-6">
        {items.length === 0 ? (
          <div className="text-center py-8" data-testid="empty-cart">
            <p className="text-gray-500">Tu carrito está vacío</p>
          </div>
        ) : (
          items.map((item, index) => {
          const basePrice = item.price;
          const hasDiscount = item.discount && item.discount > 0;
          const finalPrice = hasDiscount ? basePrice * (1 - item.discount / 100) : basePrice;

          return (
            <div key={`${item.id}-${index}`} className="flex items-center gap-3">
              <Image
                src={item.image || '/placeholder-product.jpg'}
                alt={`Imagen del producto ${item.name} en el resumen del pedido`}
                width={60}
                height={60}
                sizes="60px"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                className="w-15 h-15 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{item.variantName || item.name}</h3>
                <p className="text-xs text-gray-600">Cantidad: {item.quantity}</p>
                <div className="flex items-center gap-2">
                  {hasDiscount ? (
                    <>
                      <span className="text-xs text-gray-400 line-through">
                        {formatCurrency(basePrice)}
                      </span>
                      <span className="text-sm font-semibold text-red-600">
                        {formatCurrency(finalPrice)}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm">{formatCurrency(basePrice)}</span>
                  )}
                </div>
              </div>
              <div className="font-medium text-sm">
                {formatCurrency(finalPrice * item.quantity)}
              </div>
            </div>
          );
        })
      )}
      </div>

      {/* Dirección de envío */}
      <div className="border-t pt-4 space-y-3">
        <h3 className="font-medium text-sm">Dirección de envío</h3>
        {shippingAddress ? (
          <div className="text-sm text-gray-600">
            <p>{shippingAddress.codigoPostal}</p>
            <p>{shippingAddress.provincia}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No seleccionada</p>
        )}
      </div>

      {/* Método de envío */}
      {selectedShippingMethod && (
        <div className="border-t pt-3 space-y-3">
          <h3 className="font-medium text-sm">Método de envío</h3>
          <p className="text-sm text-gray-600">{selectedShippingMethod.name}</p>
        </div>
      )}

      {/* Resumen de precios */}
      <div className="border-t pt-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span className="text-gray-600">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Envío</span>
          <span className="text-gray-600">
            {shippingCost === null
              ? 'A seleccionar'
              : shippingCost === 0
                ? 'Gratis'
                : formatCurrency(shippingCost)}
          </span>
        </div>

        <div className="flex justify-between font-bold text-lg border-t pt-3">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Información adicional */}
      <div className="mt-6 space-y-3">
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Pago seguro con Mercado Pago</p>
          <p>• Envío gratuito en compras superiores a $5.000</p>
          <p>• Tiempo de entrega: 7-10 días hábiles</p>
        </div>

        <div className="pt-3 border-t">
          <Link href="/cart" className="text-sm text-blue-600 hover:underline">
            ← Volver al carrito
          </Link>
        </div>
      </div>
    </div>
  );
}
