"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Clock, AlertCircle, CreditCard } from 'lucide-react';

export default function PaymentPendingPage() {
  const searchParams = useSearchParams();
  const [paymentDetails, setPaymentDetails] = useState({
    paymentId: '',
    status: '',
    paymentType: '',
    merchantOrderId: '',
    externalReference: ''
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
      merchantOrderId: searchParams.get('merchant_order_id') || '',
      externalReference: searchParams.get('external_reference') || ''
    });
  }, [searchParams]);

  useEffect(() => {
    const orderIdSource =
      paymentDetails.externalReference || paymentDetails.merchantOrderId;

    const numericOrderId =
      orderIdSource && !Number.isNaN(Number(orderIdSource))
        ? orderIdSource
        : null;

    if (!numericOrderId) {
      return;
    }

    let cancelled = false;

    const fetchStatus = async () => {
      try {
        setOrderStatusLoading(true);
        setOrderStatusError(null);

        const res = await fetch(`/api/order-status?order_id=${numericOrderId}`);
        if (!res.ok) {
          throw new Error('No se pudo obtener el estado del pedido');
        }

        const data = await res.json();
        if (cancelled) {
          return;
        }

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
  }, [paymentDetails.externalReference, paymentDetails.merchantOrderId]);

  const isOfflinePayment = paymentDetails.paymentType === 'ticket' || 
                          paymentDetails.paymentType === 'atm';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-yellow-50 border-2 border-yellow-200 rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Clock className="w-16 h-16 text-yellow-500" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Pago pendiente
          </h1>

          <p className="text-gray-600 mb-6">
            Tu pago está pendiente de confirmación. Te notificaremos una vez que 
            se haya completado.
          </p>

          {(paymentDetails.externalReference || paymentDetails.merchantOrderId) && (
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
              <div className="text-sm text-gray-500 mb-2">Detalles del pago</div>
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
                    <span className="font-mono text-sm text-yellow-600">{paymentDetails.status}</span>
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

          {isOfflinePayment && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start">
                <CreditCard className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-sm text-blue-800 text-left">
                  <strong>Pago offline detectado</strong><br />
                  Para completar tu pago, dirígete al punto de pago físico 
                  con el comprobante generado. El pago será procesado una vez 
                  realizado el depósito.
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 mb-6">
            <Link href="/orders">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
                Ver mis pedidos
              </Button>
            </Link>
            
            <Link href="/products">
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-md transition-colors">
                Seguir comprando
              </Button>
            </Link>
          </div>

          <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-yellow-800 text-left">
                <strong>Importante:</strong><br />
                • Recibirás un email cuando tu pago sea confirmado<br />
                • Puedes verificar el estado en &quot;Mis pedidos&quot;<br />
                • El pago puede tardar hasta 48 horas en procesarse
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
