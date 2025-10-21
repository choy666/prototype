'use client';

import { useCartStore } from "@/lib/stores/useCartStore";
import Link from "next/link";
import Image from "next/image";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

export function CheckoutSummary() {
  const { items } = useCartStore();

  // Calcular total con descuentos
  const subtotal = items.reduce((acc, item) => {
    const basePrice = item.price;
    const finalPrice =
      item.discount && item.discount > 0 ? basePrice * (1 - item.discount / 100) : basePrice;
    return acc + finalPrice * item.quantity;
  }, 0);

  const shippingCost = 0; // Envío gratuito por ahora
  const total = subtotal + shippingCost;

  return (
    <div className="bg-gray-50 p-6 rounded-lg h-fit">
      <h2 className="text-xl font-bold mb-6">Resumen del Pedido</h2>

      {/* Lista de productos */}
      <div className="space-y-4 mb-6">
        {items.map((item, index) => {
          const basePrice = item.price;
          const hasDiscount = item.discount && item.discount > 0;
          const finalPrice = hasDiscount ? basePrice * (1 - item.discount / 100) : basePrice;

          return (
            <div key={`${item.id}-${index}`} className="flex items-center gap-3">
              <Image
                src={item.image || '/placeholder-product.jpg'}
                alt={item.name}
                width={60}
                height={60}
                className="w-15 h-15 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{item.name}</h3>
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
        })}
      </div>

      {/* Resumen de precios */}
      <div className="border-t pt-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span className="text-gray-600">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Envío</span>
          <span className="text-gray-600">
            {shippingCost === 0 ? 'Gratis' : formatCurrency(shippingCost)}
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
