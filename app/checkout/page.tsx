'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/lib/stores/useCartStore';
import { ShippingForm } from '@/components/checkout/ShippingForm';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ShippingFormData } from '@/lib/validations/checkout';
import { toast } from 'react-hot-toast';

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const { items } = useCartStore();
  const [isProcessing, setIsProcessing] = useState(false);

  // Verificar autenticación
  if (status === 'loading') {
    return (
      <div className="container mx-auto p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4">Cargando...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Acceso requerido</h1>
        <p className="mb-6">Debes iniciar sesión para continuar con el checkout.</p>
        <Link href="/auth/signin">
          <Button>Iniciar Sesión</Button>
        </Link>
      </div>
    );
  }

  // Verificar que el carrito no esté vacío
  if (items.length === 0) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Tu carrito está vacío</h1>
        <p className="mb-6">Agrega productos a tu carrito antes de proceder al checkout.</p>
        <Link href="/products">
          <Button>Ver Productos</Button>
        </Link>
      </div>
    );
  }

  const handleShippingSubmit = async (shippingData: ShippingFormData) => {
    setIsProcessing(true);

    try {
      // Preparar datos para el checkout
      const checkoutData = {
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          discount: item.discount,
        })),
        shippingAddress: shippingData,
        userId: session.user.id,
      };

      // Enviar a la API de checkout
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar el checkout');
      }

      if (data.init_point) {
        // Redirigir a Mercado Pago
        window.location.href = data.init_point;
      } else {
        throw new Error('No se recibió la URL de pago');
      }
    } catch (error) {
      console.error('Error during checkout:', error);
      toast.error(error instanceof Error ? error.message : 'Error al procesar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Checkout</h1>
        <p className="text-gray-600">Completa tu pedido</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Formulario de envío */}
        <div className="order-2 lg:order-1">
          <ShippingForm
            onSubmit={handleShippingSubmit}
            isLoading={isProcessing}
          />
        </div>

        {/* Resumen del pedido */}
        <div className="order-1 lg:order-2">
          <CheckoutSummary />
        </div>
      </div>
    </div>
  );
}
