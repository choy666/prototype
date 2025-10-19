import { useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCartStore } from '@/lib/stores/useCartStore';
import { useToast } from '@/components/ui/use-toast';

/**
 * Hook personalizado para limpiar el carrito después de un checkout exitoso
 *
 * Este hook monitorea los parámetros de URL para detectar cuando un pago ha sido exitoso
 * y automáticamente limpia el carrito del localStorage.
 *
 * @param options - Configuración opcional del hook
 * @param options.autoClean - Si debe limpiar automáticamente (default: true)
 * @param options.successStatuses - Array de estados que se consideran exitosos
 * @param options.onSuccess - Callback ejecutado cuando se detecta un pago exitoso
 * @param options.onCartCleared - Callback ejecutado después de limpiar el carrito
 *
 * @returns Objeto con funciones y estado del hook
 */

interface UseCartClearOnSuccessOptions {
  autoClean?: boolean;
  successStatuses?: string[];
  showToast?: boolean;
  onSuccess?: (paymentInfo: PaymentInfo) => void;
  onCartCleared?: () => void;
}

interface PaymentInfo {
  paymentId: string | null;
  merchantOrderId: string | null;
  status: string | null;
  collectionStatus: string | null;
  paymentType: string | null;
}

export function useCartClearOnSuccess(options: UseCartClearOnSuccessOptions = {}) {
  const {
    autoClean = true,
    successStatuses = ['approved', 'success'],
    showToast = true,
    onSuccess,
    onCartCleared,
  } = options;

  const searchParams = useSearchParams();
  const clearCart = useCartStore((state) => state.clearCart);
  const items = useCartStore((state) => state.items);
  const { toast } = useToast();

  // Función para extraer información del pago de los parámetros de URL
  const getPaymentInfo = useCallback((): PaymentInfo => {
    return {
      paymentId: searchParams.get('payment_id'),
      merchantOrderId: searchParams.get('merchant_order_id') || searchParams.get('order_id'),
      status: searchParams.get('status'),
      collectionStatus: searchParams.get('collection_status'),
      paymentType: searchParams.get('payment_type'),
    };
  }, [searchParams]);

  // Función para verificar si el pago fue exitoso
  const isPaymentSuccessful = useCallback(
    (paymentInfo: PaymentInfo): boolean => {
      const { status, collectionStatus } = paymentInfo;

      return successStatuses.some(
        (successStatus) => status === successStatus || collectionStatus === successStatus
      );
    },
    [successStatuses]
  );

  // Función manual para limpiar el carrito
  const manualClearCart = useCallback(() => {
    const paymentInfo = getPaymentInfo();

    if (items.length > 0) {
      const itemsCount = items.length;
      clearCart();

      console.log('🛒 Carrito vaciado manualmente después del checkout exitoso', {
        itemsCleared: itemsCount,
        paymentInfo,
      });

      if (showToast) {
        toast({
          title: '¡Compra exitosa!',
          description: `Tu pedido ha sido procesado. El carrito ha sido vaciado (${itemsCount} ${itemsCount === 1 ? 'producto' : 'productos'}).`,
          variant: 'default',
        });
      }

      onCartCleared?.();
    }

    return paymentInfo;
  }, [clearCart, items, onCartCleared, getPaymentInfo, showToast, toast]);

  // Efecto principal para detectar pagos exitosos
  useEffect(() => {
    const paymentInfo = getPaymentInfo();

    // Verificar si hay información de pago en la URL
    if (paymentInfo.paymentId || paymentInfo.status || paymentInfo.collectionStatus) {
      const isSuccessful = isPaymentSuccessful(paymentInfo);

      if (isSuccessful) {
        console.log('✅ Pago exitoso detectado:', paymentInfo);

        // Ejecutar callback de éxito si se proporciona
        onSuccess?.(paymentInfo);

        // Limpiar carrito automáticamente si está habilitado
        if (autoClean && items.length > 0) {
          const itemsCount = items.length;
          clearCart();

          console.log('🛒 Carrito vaciado automáticamente después del checkout exitoso', {
            itemsCleared: itemsCount,
            paymentInfo,
          });

          if (showToast) {
            toast({
              title: '¡Compra exitosa!',
              description: `Tu pedido ha sido procesado correctamente. El carrito ha sido vaciado (${itemsCount} ${itemsCount === 1 ? 'producto' : 'productos'}).`,
              variant: 'default',
            });
          }

          onCartCleared?.();
        }
      } else {
        console.log('❌ Pago no exitoso o pendiente:', paymentInfo);
      }
    }
  }, [
    searchParams,
    autoClean,
    clearCart,
    items.length,
    onSuccess,
    onCartCleared,
    getPaymentInfo,
    isPaymentSuccessful,
    showToast,
    toast,
  ]);

  // Función para limpiar parámetros de URL relacionados con el pago
  const cleanUrlParams = useCallback(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const paramsToRemove = [
        'payment_id',
        'merchant_order_id',
        'order_id',
        'status',
        'collection_status',
        'payment_type',
      ];

      let hasChanges = false;
      paramsToRemove.forEach((param) => {
        if (url.searchParams.has(param)) {
          url.searchParams.delete(param);
          hasChanges = true;
        }
      });

      if (hasChanges) {
        window.history.replaceState({}, '', url.pathname + url.search);
        console.log('🧹 Parámetros de URL de pago limpiados');
      }
    }
  }, []);

  return {
    paymentInfo: getPaymentInfo(),
    isPaymentSuccessful: isPaymentSuccessful(getPaymentInfo()),
    hasCartItems: items.length > 0,
    clearCart: manualClearCart,
    cleanUrlParams,
  };
}
