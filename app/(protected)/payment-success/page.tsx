'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

export default function PaymentSuccess() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const collectionStatus = searchParams.get('collection_status');
    const paymentId = searchParams.get('payment_id');
    const merchantOrderId = searchParams.get('merchant_order_id');
    const status = searchParams.get('status');
    const paymentType = searchParams.get('payment_type');

    // Dar tiempo para mostrar el estado antes de redirigir
    const timer = setTimeout(() => {
      setIsProcessing(false);

      if (collectionStatus === 'approved' || status === 'approved') {
        // Redirigir al dashboard con información del pago
        router.push(
          `/dashboard?payment_id=${paymentId}&order_id=${merchantOrderId}&status=success`
        );
      } else if (collectionStatus === 'pending' || status === 'pending') {
        // Redirigir a la página de pago pendiente
        router.push(`/payment-pending?payment_id=${paymentId}&order_id=${merchantOrderId}`);
      } else {
        // Redirigir a la página de fallo de pago
        router.push(`/payment-failure?payment_id=${paymentId}&order_id=${merchantOrderId}`);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [searchParams, router]);

  const getStatusInfo = () => {
    const collectionStatus = searchParams.get('collection_status');
    const status = searchParams.get('status');
    const paymentType = searchParams.get('payment_type');

    if (collectionStatus === 'approved' || status === 'approved') {
      return {
        icon: <CheckCircle className='w-16 h-16 text-green-500' />,
        title: '¡Pago Aprobado!',
        message: 'Tu pago ha sido procesado exitosamente.',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    } else if (collectionStatus === 'pending' || status === 'pending') {
      return {
        icon: <Clock className='w-16 h-16 text-yellow-500' />,
        title: 'Pago Pendiente',
        message: 'Tu pago está siendo procesado. Te notificaremos cuando esté completo.',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
      };
    } else {
      return {
        icon: <XCircle className='w-16 h-16 text-red-500' />,
        title: 'Pago Rechazado',
        message: 'Hubo un problema con tu pago. Por favor, intenta nuevamente.',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    }
  };

  const statusInfo = getStatusInfo();
  const paymentId = searchParams.get('payment_id');
  const merchantOrderId = searchParams.get('merchant_order_id');

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-100 p-4'>
      <div
        className={`max-w-md w-full ${statusInfo.bgColor} ${statusInfo.borderColor} border-2 rounded-lg shadow-lg p-8`}
      >
        <div className='text-center'>
          <div className='flex justify-center mb-6'>{statusInfo.icon}</div>

          <h1 className='text-2xl font-bold text-gray-900 mb-4'>{statusInfo.title}</h1>

          <p className='text-gray-600 mb-6'>{statusInfo.message}</p>

          {paymentId && (
            <div className='bg-white rounded-md p-4 mb-6 border'>
              <div className='text-sm text-gray-500 mb-2'>Detalles del Pago</div>
              <div className='space-y-2'>
                {paymentId && (
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>ID de Pago:</span>
                    <span className='font-mono text-sm'>{paymentId}</span>
                  </div>
                )}
                {merchantOrderId && (
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Orden:</span>
                    <span className='font-mono text-sm'>{merchantOrderId}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {isProcessing && (
            <div className='flex items-center justify-center space-x-2 text-gray-600'>
              <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600'></div>
              <span>Redirigiendo en unos segundos...</span>
            </div>
          )}

          {!isProcessing && (
            <button
              onClick={() => router.push('/dashboard')}
              className='w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors'
            >
              Ir al Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
