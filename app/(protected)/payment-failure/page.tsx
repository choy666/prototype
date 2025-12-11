"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { XCircle, AlertCircle } from 'lucide-react';

export default function PaymentFailurePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState({
    paymentId: '',
    status: '',
    paymentType: '',
    merchantOrderId: ''
  });
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [orderStatusLoading, setOrderStatusLoading] = useState(false);
  const [orderStatusError, setOrderStatusError] = useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Función para redirigir con validación de tiempo
  const performRedirect = useCallback(() => {
    const { paymentId } = paymentDetails;
    if (paymentId) {
      console.log('[TIMER] Redirigiendo al dashboard');
      router.push(
        `/dashboard?payment_id=${paymentId}&order_id=${paymentDetails.merchantOrderId}&status=failed`
      );
    }
  }, [paymentDetails, router]);

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
  }, [searchParams, paymentDetails.merchantOrderId]);

  // Efecto para manejar el redireccionamiento automático
  useEffect(() => {
    const { paymentId, status } = paymentDetails;

    // Para pagos fallidos, redirigir inmediatamente (no hay nada que esperar)
    if ((status === 'rejected' || status === 'cancelled' || status === 'failed') && paymentId) {
      console.log('[FAILURE] Pago fallido confirmado, redirigiendo al dashboard');
      setIsProcessing(false);
      performRedirect();
      return;
    }
  }, [paymentDetails, router, performRedirect]);

  // Cleanup de timeouts cuando el componente se desmonta
  useEffect(() => {
    const timeoutRef = redirectTimeoutRef.current;
    return () => {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
    };
  }, []);

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
                ? `Verificando... (intento ${pollingAttempts})`
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

          {isProcessing && (
            <div className='space-y-4'>
              <div className='text-sm text-gray-600'>
                Verificando estado del pago...
              </div>
              
              <div className='flex items-center justify-center space-x-2 text-gray-600'>
                <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-red-600'></div>
                <span>Estamos verificando el estado de tu pago con Mercado Pago...</span>
              </div>
              
              {showTimeoutMessage && (
                <div className='bg-yellow-100 border border-yellow-300 rounded-lg p-4 space-y-3'>
                  <div className='text-sm text-yellow-800'>
                    <strong>Está tomando más tiempo de lo esperado</strong>
                    <br />
                    La verificación del pago está tardando más de lo habitual. 
                    Puedes continuar al dashboard o esperar un poco más.
                  </div>
                  <button
                    onClick={() => {
                      setIsProcessing(false);
                      performRedirect();
                    }}
                    className='w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded transition-colors'
                  >
                    Continuar al Dashboard
                  </button>
                </div>
              )}
            </div>
          )}

          {!isProcessing && (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600'></div>
                <span>Redirigiendo al dashboard...</span>
              </div>
              
              <div className="text-sm text-gray-500 text-center">
                Por favor espera mientras te redirigimos...
              </div>
            </div>
          )}

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
