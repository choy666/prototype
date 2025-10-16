'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Clock } from 'lucide-react';

export default function CheckoutPendingPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-8 text-center max-w-2xl">
      <Clock className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
      <h1 className="text-3xl font-bold mb-4 text-yellow-600">
        Pago pendiente
      </h1>
      <p className="text-lg text-gray-600 mb-6">
        Tu pago está siendo procesado. Te notificaremos cuando se complete.
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
