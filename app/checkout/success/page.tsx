// app/checkout/success/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCartStore } from '@/lib/stores/useCartStore';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const { clearCart } = useCartStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderStatus = useCallback(async (orderId: string) => {
    try {
      const response = await fetch(`/api/order-status?order_id=${orderId}`);
      const data = await response.json();

      if (response.ok) {
        // Actualizar estado basado en el estado real de la orden
        switch (data.status) {
          case 'paid':
            setStatus('success');
            clearCart(); // Limpiar carrito solo si el pago está confirmado
            break;
          case 'cancelled':
            setStatus('error');
            break;
          case 'pending':
            setStatus('pending');
            break;
          default:
            setStatus('pending');
        }
      } else {
        setError(data.error || 'Error al verificar el estado de la orden');
        setStatus('error');
      }
    } catch (err) {
      console.error('Error fetching order status:', err);
      setError('Error al conectar con el servidor');
      setStatus('error');
    }
  }, [clearCart]);

  useEffect(() => {
    const orderIdParam = searchParams.get('order_id');
    const statusParam = searchParams.get('status');

    if (orderIdParam) {
      setOrderId(orderIdParam);
      // Verificar el estado real de la orden desde la API
      fetchOrderStatus(orderIdParam);
    }

    // Determinar estado inicial basado en parámetros de Mercado Pago
    if (statusParam === 'approved') {
      setStatus('success');
    } else if (statusParam === 'rejected' || statusParam === 'cancelled') {
      setStatus('error');
    } else if (statusParam === 'pending' || statusParam === 'in_process') {
      setStatus('pending');
    } else {
      // Si no hay parámetro de estado, mantener loading hasta verificar con API
      setStatus('loading');
    }
  }, [searchParams, fetchOrderStatus]);

  if (status === 'loading') {
    return (
      <div className="container mx-auto p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold mb-4">Verificando pago...</h1>
        <p className="text-gray-600">Por favor espera mientras procesamos tu pago.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 text-center max-w-2xl">
      {status === 'success' ? (
        <div>
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4 text-green-600">
            ¡Pago exitoso!
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Tu pedido ha sido procesado correctamente.
            {orderId && ` Número de orden: #${orderId}`}
          </p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">¿Qué sucede ahora?</h2>
            <ul className="text-left space-y-2 text-gray-700">
              <li>• Recibirás un email de confirmación con los detalles de tu pedido</li>
              <li>• Procesaremos tu pedido en las próximas 24-48 horas</li>
              <li>• Te enviaremos actualizaciones sobre el envío</li>
            </ul>
          </div>
        </div>
      ) : status === 'pending' ? (
        <div>
          <Clock className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4 text-yellow-600">
            Pago pendiente
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Tu pago está siendo procesado. Te notificaremos cuando se complete.
            {orderId && ` Número de orden: #${orderId}`}
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Estado del pago</h2>
            <p className="text-gray-700 mb-4">
              Algunos métodos de pago pueden tardar unos minutos en procesarse.
              Recibirás una notificación por email cuando se complete el proceso.
            </p>
            <ul className="text-left space-y-2 text-gray-700">
              <li>• Revisa tu email para actualizaciones</li>
              <li>• El procesamiento puede tardar hasta 24 horas</li>
              <li>• No intentes pagar nuevamente mientras esté pendiente</li>
            </ul>
          </div>
        </div>
      ) : (
        <div>
          <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4 text-red-600">
            Pago no completado
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Hubo un problema al procesar tu pago. Por favor, intenta nuevamente.
            {error && <span className="block text-red-500 mt-2">{error}</span>}
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Posibles razones:</h2>
            <ul className="text-left space-y-2 text-gray-700">
              <li>• Fondos insuficientes en tu tarjeta</li>
              <li>• Datos de pago incorrectos</li>
              <li>• Problemas temporales con el procesador de pagos</li>
              <li>• El pago fue cancelado por el usuario</li>
            </ul>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <Link href="/products">
          <Button size="lg">
            Continuar comprando
          </Button>
        </Link>

        <div>
          <Link href="/orders" className="text-blue-600 hover:underline">
            Ver mis pedidos
          </Link>
        </div>
      </div>
    </div>
  );
}
