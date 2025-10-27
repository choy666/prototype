'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, MapPin, CreditCard, Calendar } from 'lucide-react';
import OrderTimeline from '@/components/orders/OrderTimeline';

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
      setOrder(orderData);
    } catch (error) {
      console.error('Error al cargar la orden:', error);
      setError('Error de conexión. Verifica tu conexión a internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

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
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <Image
                      src={item.productImage || '/placeholder-product.jpg'}
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
                        {item.productName}
                      </h4>
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
                ))}
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
        </div>
      </div>
    </div>
  );
}
