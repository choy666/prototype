'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { XCircle } from 'lucide-react';

export default function CheckoutFailurePage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-8 text-center max-w-2xl">
      <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
      <h1 className="text-3xl font-bold mb-4 text-red-600">
        Pago cancelado
      </h1>
      <p className="text-lg text-gray-600 mb-6">
        El pago ha sido cancelado. No se ha realizado ningún cargo a tu cuenta.
      </p>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">¿Qué puedes hacer?</h2>
        <ul className="text-left space-y-2 text-gray-700">
          <li>• Revisar los datos de tu tarjeta o método de pago</li>
          <li>• Verificar que tengas fondos suficientes</li>
          <li>• Intentar con un método de pago diferente</li>
          <li>• Contactar a tu banco si el problema persiste</li>
        </ul>
      </div>

      <div className="space-y-4">
        <Button
          onClick={() => router.back()}
          size="lg"
        >
          Intentar nuevamente
        </Button>

        <div>
          <Link href="/cart" className="text-blue-600 hover:underline">
            Volver al carrito
          </Link>
        </div>
      </div>
    </div>
  );
}
