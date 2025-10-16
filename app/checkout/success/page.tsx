'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { CheckCircle, XCircle } from 'lucide-react';

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const orderIdParam = searchParams.get('order_id');
    const statusParam = searchParams.get('status');

    if (orderIdParam) {
      setOrderId(orderIdParam);
    }

    // Simular verificación del estado del pago
    // En producción, deberías verificar con tu API
    if (statusParam === 'approved') {
      setStatus('success');
    } else if (statusParam === 'rejected' || statusParam === 'cancelled') {
      setStatus('error');
    } else {
      // Verificar el estado de la orden desde la API
      setStatus('success'); // Por ahora asumimos éxito
    }
  }, [searchParams]);

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
      ) : (
        <div>
          <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4 text-red-600">
            Pago no completado
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Hubo un problema al procesar tu pago. Por favor, intenta nuevamente.
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Posibles razones:</h2>
            <ul className="text-left space-y-2 text-gray-700">
              <li>• Fondos insuficientes en tu tarjeta</li>
              <li>• Datos de pago incorrectos</li>
              <li>• Problemas temporales con el procesador de pagos</li>
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
