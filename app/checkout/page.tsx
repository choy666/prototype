'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/stores/useCartStore';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

export default function CheckoutPage() {
  const { items, clearCart } = useCartStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar el pago');
      }

      // Redirigir a Mercado Pago
      window.location.href = data.initPoint;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

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
                  Serás redirigido a Mercado Pago para completar tu pago de forma segura.
                </p>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <Button
                  onClick={handleCheckout}
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    `Pagar ${formatCurrency(total)}`
                  )}
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
