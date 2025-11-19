'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, MapPin, CreditCard, Calendar } from 'lucide-react';
import OrderTimeline from '@/components/orders/OrderTimeline';
import { convertAttributesToObject } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

type ShippingAddress = {
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  telefono: string;
};

type Order = {
  id: string;
  userId: number;
  total: number;
  status: OrderStatus;
  paymentId?: string;
  mercadoPagoId?: string;
  shippingAddress?: ShippingAddress;
  shippingMethodId?: number;
  shippingCost: number;
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
  items: {
    id: string;
    quantity: number;
    price: number;
    productId: number;
    productName: string;
    productImage?: string;
    productAttributes?: Record<string, string>;
    variantId?: number;
    variantName?: string;
    variantImage?: string[];
    variantAttributes?: Record<string, string>;
  }[];
};

export default function OrderDetailPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();

  const fetchOrderDetail = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${orderId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Orden no encontrada');
        } else if (response.status === 403) {
          setError('No tienes permisos para ver esta orden');
        } else if (response.status === 401) {
          setError('Usuario no autenticado');
        } else if (response.status === 400) {
          setError('ID de orden inválido');
        } else {
          setError('Error al cargar la orden. Por favor, intenta de nuevo.');
        }
        return;
      }

      const orderData = await response.json();
      console.log('Order data loaded:', orderData); // Debug log
      setOrder(orderData);
    } catch (error) {
      console.error('Error al cargar la orden:', error);
      setError('Error de conexión. Verifica tu conexión a internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const handleCancelOrder = useCallback(async () => {
    if (!cancelReason.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor, ingresa una justificación para la cancelación.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCancelling(true);
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cancelar la orden');
      }

      await response.json();

      toast({
        title: 'Éxito',
        description: 'La orden ha sido cancelada exitosamente.',
      });

      // Refresh order data
      fetchOrderDetail();
      setShowCancelDialog(false);
      setCancelReason('');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al cancelar la orden',
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
    }
  }, [cancelReason, orderId, toast, fetchOrderDetail]);

  const canCancelOrder = order && order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'shipped';

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login?callbackUrl=/orders/' + orderId);
      return;
    }

    if (sessionStatus === 'authenticated' && orderId) {
      fetchOrderDetail();
    }
  }, [sessionStatus, router, orderId, fetchOrderDetail]);

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Error
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Mis Pedidos
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Orden no encontrada
          </h1>
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Mis Pedidos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Mis Pedidos
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Información de la Orden */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Orden #{order.id}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  order.status === 'delivered'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                    : order.status === 'shipped'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                    : order.status === 'paid'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                    : order.status === 'cancelled'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                }`}
              >
                {order.status === 'pending' && 'Pendiente'}
                {order.status === 'paid' && 'Pagado'}
                {order.status === 'shipped' && 'Enviado'}
                {order.status === 'delivered' && 'Entregado'}
                {order.status === 'cancelled' && 'Cancelado'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Fecha del pedido</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(order.createdAt).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {order.mercadoPagoId && (
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ID de Pago</p>
                    <p className="font-medium text-gray-900 dark:text-white font-mono text-sm">
                      {order.mercadoPagoId}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Dirección de envío */}
            {order.shippingAddress && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Dirección de Envío
                  </h3>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-gray-900 dark:text-white">
                    {order.shippingAddress.nombre}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {order.shippingAddress.direccion}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {order.shippingAddress.ciudad}, {order.shippingAddress.provincia}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    CP: {order.shippingAddress.codigoPostal}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    Tel: {order.shippingAddress.telefono}
                  </p>
                </div>
              </div>
            )}

            {/* Productos */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                Productos
              </h3>
              <div className="space-y-4">
                {(() => {
                  try {
                    console.log('Rendering order items:', order.items); // Debug log
                    return order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                        <Image
                          src={
                            item.variantId && 
                            Array.isArray(item.variantImage) && 
                            item.variantImage.length > 0 
                              ? item.variantImage[0] 
                              : (typeof item.productImage === 'string' ? item.productImage : '/placeholder-product.jpg')
                          }
                          alt={item.productName}
                          width={60}
                          height={60}
                          sizes="60px"
                          placeholder="blur"
                          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                          className="rounded-lg object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {item.productName}{item.variantName ? ` - ${item.variantName}` : ''}
                          </h4>
                          {(() => {
                            // Si hay variante, mostrar solo atributos de variante
                            if (item.variantId) {
                              const variantAttrs = convertAttributesToObject(item.variantAttributes);
                              return Object.keys(variantAttrs).length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1 mb-2">
                                  {Object.entries(variantAttrs).map(([key, value]) => (
                                    <span key={`variant-${key}`} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                      {key}: {String(value)}
                                    </span>
                                  ))}
                                </div>
                              ) : null;
                            } else {
                              // Si no hay variante, mostrar atributos del producto
                              let productAttrs: Record<string, string> = {};
                              if (Array.isArray(item.productAttributes)) {
                                item.productAttributes.forEach((attr: { name?: string; values?: string[] }) => {
                                  if (attr.name && Array.isArray(attr.values) && attr.values.length > 0) {
                                    productAttrs[attr.name] = attr.values[0];
                                  }
                                });
                              } else if (typeof item.productAttributes === 'object' && item.productAttributes !== null) {
                                productAttrs = item.productAttributes as Record<string, string>;
                              }

                              return Object.keys(productAttrs).length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1 mb-2">
                                  {Object.entries(productAttrs).map(([key, value]) => (
                                    <span key={`product-${key}`} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                      {key}: {String(value)}
                                    </span>
                                  ))}
                                </div>
                              ) : null;
                            }
                          })()}
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Cantidad: {item.quantity} × ${item.price.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900 dark:text-white">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ));
                  } catch (renderError) {
                    console.error('Error rendering order items:', renderError);
                    return (
                      <div className="p-4 border border-red-200 dark:border-red-700 rounded-lg bg-red-50 dark:bg-red-900/20">
                        <p className="text-red-600 dark:text-red-400">Error al mostrar los productos del pedido. Contacta soporte.</p>
                      </div>
                    );
                  }
                })()}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total</span>
                  <span>${order.total.toFixed(2)}</span>
                </div>
                {order.shippingCost > 0 && (
                  <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-300 mt-1">
                    <span>Costo de envío</span>
                    <span>${order.shippingCost.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-1">
          <OrderTimeline
            currentStatus={order.status}
            createdAt={order.createdAt}
            trackingNumber={order.trackingNumber}
          />

          {/* Cancel Order Section */}
          {canCancelOrder && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Cancelar Orden
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Si necesitas cancelar tu orden, puedes hacerlo aquí. Proporciona una razón para la cancelación.
              </p>

              <button
                onClick={() => setShowCancelDialog(true)}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                disabled={cancelling}
              >
                {cancelling ? 'Cancelando...' : 'Cancelar Orden'}
              </button>

              {showCancelDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Cancelar Orden
                    </h3>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Razón de cancelación
                      </label>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Explica por qué deseas cancelar la orden..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setShowCancelDialog(false)}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleCancelOrder}
                        disabled={cancelling || !cancelReason.trim()}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {cancelling ? 'Cancelando...' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
