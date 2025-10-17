// app/checkout/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/stores/useCartStore';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

export default function CheckoutPage() {
  const { items } = useCartStore();
  const router = useRouter();

  // Redirigir si no hay items en el carrito
  useEffect(() => {
    if (items.length === 0) {
      router.push('/cart');
    }
  }, [items, router]);

  // Calcular total
  const total = items.reduce((acc, item) => {
    const finalPrice = item.discount && item.discount > 0
      ? item.price * (1 - item.discount / 100)
      : item.price;
    return acc + finalPrice * item.quantity;
  }, 0);

  if (items.length === 0) {
    return null; // Redirigiendo...
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Resumen del pedido */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Resumen del pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item) => {
                  const finalPrice = item.discount && item.discount > 0
                    ? item.price * (1 - item.discount / 100)
                    : item.price;

                  return (
                    <div key={item.id} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          Cantidad: {item.quantity}
                        </p>
                      </div>
                      <p className="font-medium">
                        {formatCurrency(finalPrice * item.quantity)}
                      </p>
                    </div>
                  );
                })}

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Información de pago */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Información de pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  La funcionalidad de pago se implementará próximamente.
                </p>

                <Button
                  disabled={true}
                  className="w-full"
                  size="lg"
                >
                  Pagar {formatCurrency(total)}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => router.push('/cart')}
                  className="w-full"
                >
                  Volver al carrito
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}