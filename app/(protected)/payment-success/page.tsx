'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { useCartClearOnSuccess } from '@/hooks/useCartClearOnSuccess';

export default function PaymentSuccess() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [orderStatusLoading, setOrderStatusLoading] = useState(false);
  const [orderStatusError, setOrderStatusError] = useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Procesar pago vía fallback si es aprobado
  useEffect(() => {
    const { paymentId, merchantOrderId, collectionStatus, status } = paymentInfo;

    // Solo procesar si el pago está aprobado y tenemos paymentId
    if ((collectionStatus === 'approved' || status === 'approved') && paymentId) {
      const processPayment = async () => {
        try {
          // Pequeño delay para dar prioridad al webhook
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log('[SUCCESS-FALLBACK] Procesando pago aprobado vía fallback', {
            paymentId,
            merchantOrderId,
            status,
            collectionStatus,
          });
          
          const response = await fetch('/api/checkout/process-success', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              payment_id: paymentId,
              merchant_order_id: merchantOrderId,
              status: status,
              collection_status: collectionStatus,
            }),
          });

          const result = await response.json();
          
          if (result.success) {
            console.log('✅ [SUCCESS-FALLBACK] Pago procesado correctamente:', {
              paymentId,
              result: result.status,
            });
          } else {
            console.error('❌ [SUCCESS-FALLBACK] Error procesando pago:', result.error);
          }
        } catch (error) {
          console.error('❌ [SUCCESS-FALLBACK] Error en llamada de fallback:', error);
        }
      };

      // Procesar en background para no bloquear UI
      processPayment();
    }
  }, [paymentInfo]);

  useEffect(() => {
    const { merchantOrderId, collectionStatus, status, paymentId } = paymentInfo;

    // Si Mercado Pago ya indica aprobado, establecemos el estado como aprobado localmente
    const isApproved =
      collectionStatus === 'approved' || status === 'approved';

    if (isApproved) {
      console.log('[PAYMENT-SUCCESS] Mercado Pago aprobó el pago, estableciendo estado local como paid', {
        paymentId,
        merchantOrderId,
        collectionStatus,
        status
      });
      setOrderStatus('paid');
      setIsProcessing(false);
      return;
    }

    const numericOrderId =
      merchantOrderId && !Number.isNaN(Number(merchantOrderId))
        ? merchantOrderId
        : null;

    if (!numericOrderId) {
      return;
    }

    let cancelled = false;
    let cooldownUntil = 0;
    let attempts = 0;

    // Timeout de seguridad: mostrar mensaje después de 60 segundos
    const timeoutTimer = setTimeout(() => {
      if (!cancelled) {
        setShowTimeoutMessage(true);
      }
    }, 60000);

    const getPollingInterval = () => {
      // Primeros 30 segundos: 2 segundos
      // Después: 5 segundos
      return attempts < 15 ? 2000 : 5000;
    };

    const fetchStatus = async () => {
      if (cancelled) return;

      const now = Date.now();
      if (now < cooldownUntil) {
        // En periodo de enfriamiento tras un 429, no hacer nuevas requests
        return;
      }

      try {
        setOrderStatusLoading(true);
        setOrderStatusError(null);
        attempts++;
        setPollingAttempts(attempts);

        const res = await fetch(`/api/order-status?order_id=${numericOrderId}`);

        if (res.status === 429) {
          // Demasiadas solicitudes: aplicar backoff suave
          cooldownUntil = Date.now() + 15000; // 15s sin nuevas requests
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

        // Si la llamada fue exitosa, limpiar cooldown
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
    const interval = setInterval(() => {
      fetchStatus();
    }, getPollingInterval());

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timeoutTimer);
    };
  }, [paymentInfo]);

  useEffect(() => {
    // Solo redirigir cuando tengamos confirmación del estado del pedido
    const { paymentId, merchantOrderId, collectionStatus, status } = paymentInfo;

    // Si ya tenemos estado confirmado localmente, redirigir inmediatamente
    if (orderStatus && (orderStatus === 'paid' || orderStatus === 'delivered' || orderStatus === 'processing')) {
      setIsProcessing(false);
      router.push(
        `/dashboard?payment_id=${paymentId}&order_id=${merchantOrderId}&status=success`
      );
      return;
    }

    // Si Mercado Pago indica aprobado pero aún no está confirmado localmente, esperar un momento antes de redirigir
    if (collectionStatus === 'approved' || status === 'approved') {
      setIsProcessing(false);
      // Limpiar timeout anterior si existe
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      // Validar que tenemos paymentId antes de redirigir
      if (paymentId) {
        // Redirigir después de 7 segundos para que el usuario pueda leer el mensaje de éxito
        redirectTimeoutRef.current = setTimeout(() => {
          router.push(
            `/dashboard?payment_id=${paymentId}&order_id=${merchantOrderId}&status=success`
          );
        }, 9000);
      }
      return;
    }

    // Si está pendiente, redirigir a página de pendiente
    if (collectionStatus === 'pending' || status === 'pending') {
      setIsProcessing(false);
      router.push(`/payment-pending?payment_id=${paymentId}&order_id=${merchantOrderId}`);
      return;
    }

    // Si está rechazado, redirigir a página de fallo
    if (collectionStatus === 'rejected' || status === 'rejected' || status === 'cancelled') {
      setIsProcessing(false);
      router.push(`/payment-failure?payment_id=${paymentId}&order_id=${merchantOrderId}`);
      return;
    }

    // Para cualquier otro estado, mantener en página de procesamiento
    setIsProcessing(true);
  }, [paymentInfo, orderStatus, router]);

  // Cleanup de timeouts cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const getStatusInfo = () => {
    const { collectionStatus, status } = paymentInfo;

    // Siempre mostrar "Compra Realizada con Éxito" para pagos aprobados
    if (orderStatus === 'paid' || orderStatus === 'delivered' || orderStatus === 'pending' || orderStatus === 'processing') {
      return {
        icon: <CheckCircle className='w-16 h-16 text-green-500' />,
        title: '¡Compra Realizada con Éxito!',
        message: 'Tu compra fue realizada con éxito. Durante las próximas 24hs armaremos tu pedido y corroboraremos tu pago correspondiente para terminar de prepararlo para ser despachado o retirado.',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    } else if (
      orderStatus === 'rejected' ||
      orderStatus === 'cancelled' ||
      orderStatus === 'failed' ||
      orderStatus === 'returned'
    ) {
      return {
        icon: <XCircle className='w-16 h-16 text-red-500' />,
        title: 'Compra Cancelada',
        message: 'Tu compra fue cancelada. Durante las próximas 24hs informaremos el error de tu compra por mensaje.',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    }

    // Lógica para estados directos de Mercado Pago (cuando aún no se actualizó localmente)
    if (collectionStatus === 'approved' || status === 'approved') {
      return {
        icon: <CheckCircle className='w-16 h-16 text-green-500' />,
        title: '¡Compra Realizada con Éxito!',
        message: 'Tu compra fue realizada con éxito. Durante las próximas 24hs armaremos tu pedido y corroboraremos tu pago correspondiente para terminar de prepararlo para ser despachado o retirado.',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    } else if (collectionStatus === 'pending' || status === 'pending') {
      return {
        icon: <CheckCircle className='w-16 h-16 text-green-500' />,
        title: '¡Compra Realizada con Éxito!',
        message: 'Tu compra fue realizada con éxito. Durante las próximas 24hs armaremos tu pedido y corroboraremos tu pago correspondiente para terminar de prepararlo para ser despachado o retirado.',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    } else {
      return {
        icon: <XCircle className='w-16 h-16 text-red-500' />,
        title: 'Compra Cancelada',
        message: 'Tu compra fue cancelada. Durante las próximas 24hs informaremos el error de tu compra por mensaje.',
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
                ? `Verificando... (intento ${pollingAttempts})`
                : orderStatus || 'No disponible'}
            </div>
          )}
          {orderStatusError && (
            <div className='mb-4 text-sm text-red-500'>
              {orderStatusError}
            </div>
          )}

          {isProcessing && (
            <div className='space-y-4'>
              <div className='text-sm text-gray-600'>
                Procesando tu pago...
              </div>
              
              {showTimeoutMessage && (
                <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3'>
                  <div className='text-sm text-yellow-800'>
                    <strong>Está tomando más tiempo de lo esperado</strong>
                    <br />
                    La verificación del pago está tardando más de lo habitual. 
                    El webhook de Mercado Pago completará tu pedido en segundo plano.
                  </div>
                  <button
                    onClick={() => {
                      setIsProcessing(false);
                      router.push(
                        `/dashboard?payment_id=${paymentInfo.paymentId}&order_id=${paymentInfo.merchantOrderId}&status=processing`
                      );
                    }}
                    className='w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded transition-colors'
                  >
                    Continuar al Dashboard
                  </button>
                </div>
              )}
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
