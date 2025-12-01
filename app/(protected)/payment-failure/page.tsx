"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { XCircle, AlertCircle } from 'lucide-react';

export default function PaymentFailurePage() {
  const searchParams = useSearchParams();
  const [paymentDetails, setPaymentDetails] = useState({
    paymentId: '',
    status: '',
    paymentType: '',
    merchantOrderId: ''
  });
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [orderStatusLoading, setOrderStatusLoading] = useState(false);
  const [orderStatusError, setOrderStatusError] = useState<string | null>(null);

  useEffect(() => {
    // Extraer parámetros de la URL de Mercado Pago
    setPaymentDetails({
      paymentId: searchParams.get('payment_id') || '',
      status: searchParams.get('status') || '',
      paymentType: searchParams.get('payment_type') || '',
      merchantOrderId: searchParams.get('merchant_order_id') || ''
    });
  }, [searchParams]);

  useEffect(() => {
    const externalReference = searchParams.get('external_reference');
    const orderIdSource = externalReference || paymentDetails.merchantOrderId;

    const numericOrderId =
      orderIdSource && !Number.isNaN(Number(orderIdSource))
        ? orderIdSource
        : null;

    if (!numericOrderId) {
      return;
    }

    let cancelled = false;
    let cooldownUntil = 0;

    const fetchStatus = async () => {
      if (cancelled) return;

      const now = Date.now();
      if (now < cooldownUntil) {
        return;
      }

      try {
        setOrderStatusLoading(true);
        setOrderStatusError(null);

        const res = await fetch(`/api/order-status?order_id=${numericOrderId}`);

        if (res.status === 429) {
          cooldownUntil = Date.now() + 15000;
          setOrderStatusError('Demasiadas consultas, reintentando en unos segundos...');
          return;
        }

        if (!res.ok) {
          throw new Error('No se pudo obtener el estado del pedido');
        }

        const data = await res.json();
        if (cancelled) {
          return;
        }

        cooldownUntil = 0;
        setOrderStatus(data.status ?? null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setOrderStatusError(
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        if (!cancelled) {
          setOrderStatusLoading(false);
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [searchParams, paymentDetails.merchantOrderId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-red-50 border-2 border-red-200 rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <XCircle className="w-16 h-16 text-red-500" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            ¡El pago ha fallado!
          </h1>

          <p className="text-gray-600 mb-6">
            Lo sentimos, pero no hemos podido procesar tu pago. Por favor, 
            inténtalo de nuevo o contacta con soporte si el problema persiste.
          </p>

          {(searchParams.get('external_reference') || paymentDetails.merchantOrderId) && (
            <div className="mb-4 text-sm text-gray-600">
              Estado del pedido:{' '}
              {orderStatusLoading
                ? 'Verificando...'
                : orderStatus || 'No disponible'}
            </div>
          )}
          {orderStatusError && (
            <div className="mb-4 text-sm text-red-500">
              {orderStatusError}
            </div>
          )}

          {paymentDetails.paymentId && (
            <div className="bg-white rounded-md p-4 mb-6 border">
              <div className="text-sm text-gray-500 mb-2">Detalles del intento de pago</div>
              <div className="space-y-2 text-left">
                {paymentDetails.paymentId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">ID de Pago:</span>
                    <span className="font-mono text-sm">{paymentDetails.paymentId}</span>
                  </div>
                )}
                {paymentDetails.status && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <span className="font-mono text-sm text-red-600">{paymentDetails.status}</span>
                  </div>
                )}
                {paymentDetails.paymentType && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo de pago:</span>
                    <span className="font-mono text-sm">{paymentDetails.paymentType}</span>
                  </div>
                )}
                {paymentDetails.merchantOrderId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Orden:</span>
                    <span className="font-mono text-sm">{paymentDetails.merchantOrderId}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Link href="/cart">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
                Volver al carrito
              </Button>
            </Link>
            
            <Link href="/products">
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-md transition-colors">
                Seguir comprando
              </Button>
            </Link>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-yellow-800 text-left">
                <strong>¿Necesitas ayuda?</strong><br />
                Si el problema persiste, contacta a nuestro equipo de soporte o 
                intenta con otro método de pago.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
