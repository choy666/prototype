'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { useCartClearOnSuccess } from '@/hooks/useCartClearOnSuccess';

export default function PaymentSuccess() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [orderStatusLoading, setOrderStatusLoading] = useState(false);
  const [orderStatusError, setOrderStatusError] = useState<string | null>(null);

  // Usar el hook personalizado para manejar la limpieza del carrito
  const { paymentInfo } = useCartClearOnSuccess({
    autoClean: true,
    onSuccess: (info) => {
      console.log('✅ Pago exitoso procesado:', info);
    },
    onCartCleared: () => {
      console.log('🛒 Carrito limpiado exitosamente en payment-success');
    },
  });

  useEffect(() => {
    const { merchantOrderId } = paymentInfo;
    const numericOrderId =
      merchantOrderId && !Number.isNaN(Number(merchantOrderId))
        ? merchantOrderId
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
  }, [paymentInfo]);

  useEffect(() => {
    // Dar tiempo para mostrar el estado antes de redirigir
    const timer = setTimeout(() => {
      setIsProcessing(false);

      const { paymentId, merchantOrderId, collectionStatus, status } = paymentInfo;

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
  }, [paymentInfo, router]);

  const getStatusInfo = () => {
    const { collectionStatus, status } = paymentInfo;

    if (orderStatus === 'paid' || orderStatus === 'delivered') {
      return {
        icon: <CheckCircle className='w-16 h-16 text-green-500' />,
        title: '¡Pago Aprobado!',
        message: 'Tu pago ha sido procesado exitosamente.',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    } else if (
      orderStatus === 'pending' ||
      orderStatus === 'processing'
    ) {
      return {
        icon: <Clock className='w-16 h-16 text-yellow-500' />,
        title: 'Pago Pendiente',
        message: 'Tu pago está siendo procesado. Te notificaremos cuando esté completo.',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
      };
    } else if (
      orderStatus === 'rejected' ||
      orderStatus === 'cancelled' ||
      orderStatus === 'failed' ||
      orderStatus === 'returned'
    ) {
      return {
        icon: <XCircle className='w-16 h-16 text-red-500' />,
        title: 'Pago Rechazado',
        message: 'Hubo un problema con tu pago. Por favor, intenta nuevamente.',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    }

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
  const { paymentId, merchantOrderId } = paymentInfo;

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

          {merchantOrderId && (
            <div className='mb-4 text-sm text-gray-600'>
              Estado del pedido:{' '}
              {orderStatusLoading
                ? 'Verificando...'
                : orderStatus || 'No disponible'}
            </div>
          )}
          {orderStatusError && (
            <div className='mb-4 text-sm text-red-500'>
              {orderStatusError}
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
