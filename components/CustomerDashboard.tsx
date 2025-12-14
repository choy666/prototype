'use client';

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LogOut, 
  ShoppingCart, 
  Package, 
  MapPin,
  Heart,
  Shield,
  Truck,
  Clock,
  CheckCircle,
  CreditCard,
  HeadphonesIcon
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useCartClearOnSuccess } from '@/hooks/useCartClearOnSuccess';
import { getCustomerOrders, getCustomerAddresses } from '@/lib/actions/customer-orders';

interface CustomerOrder {
  id: number;
  total: number;
  status: string;
  createdAt: Date;
  trackingCode?: string | null;
  estimatedDelivery?: Date;
}

interface CustomerAddress {
  id: number;
  street: string;
  city: string;
  zipCode: string;
  isDefault: boolean;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Usar el hook personalizado para manejar la limpieza del carrito
  const { paymentInfo, isPaymentSuccessful, cleanUrlParams } = useCartClearOnSuccess({
    autoClean: true,
    onSuccess: (info) => {
      console.log('✅ Pago exitoso detectado en dashboard:', info);
    },
    onCartCleared: () => {
      console.log('🛒 Carrito limpiado exitosamente en dashboard');
    },
  });

  // Cargar datos del cliente
  const loadCustomerData = useCallback(async () => {
    try {
      const ordersData = await getCustomerOrders(session?.user?.email);
      if (ordersData.success) {
        setOrders(ordersData.orders || []);
      }
      
      const addressesData = await getCustomerAddresses();
      if (addressesData.success) {
        setAddresses(addressesData.addresses || []);
      }
    } catch (error) {
      console.error('Error al cargar datos del cliente:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadCustomerData();
    }
  }, [status, session, loadCustomerData]);

  // Función para cerrar sesión
  const handleSignOut = async () => {
    try {
      await signOut({
        redirect: false,
        callbackUrl: '/',
      });
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Efecto para manejar redirecciones y limpieza de URL
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard');
      return;
    }

    if (isPaymentSuccessful && paymentInfo.paymentId) {
      const timer = setTimeout(() => {
        cleanUrlParams();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [status, router, isPaymentSuccessful, paymentInfo.paymentId, cleanUrlParams]);

  if (status === 'loading' || !session?.user) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-md p-6'>
        {/* Header con bienvenida y badge de confianza */}
        <div className='flex justify-between items-start mb-6'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>
              Mi Panel Personal
            </h1>
            <p className='text-gray-600 dark:text-gray-300'>
              ¡Bienvenido de vuelta,{' '}
              <span className='font-semibold'>{session.user.name || 'Usuario'}</span>!
            </p>
            <div className='flex items-center gap-2 mt-2'>
              <Shield className='h-4 w-4 text-green-600' />
              <span className='text-sm text-green-600 dark:text-green-400 font-medium'>
                Compra 100% Segura
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-lg border border-red-200 dark:border-red-800 transition-colors'
          >
            <LogOut className='h-4 w-4' />
          </button>
        </div>

        
        {/* Métricas principales del cliente */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
          {/* Pedidos activos */}
          <div className='bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-6 border border-blue-200 dark:border-blue-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-blue-600 dark:text-blue-400'>Pedidos activos</p>
                <p className='text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1'>
                  {orders.filter(o => o.status === 'pending' || o.status === 'processing').length}
                </p>
                <p className='text-xs text-blue-700 dark:text-blue-300 mt-1'>
                  En camino
                </p>
              </div>
              <div className='bg-blue-500 bg-opacity-10 p-3 rounded-lg'>
                <Package className='h-6 w-6 text-blue-600 dark:text-blue-400' />
              </div>
            </div>
          </div>

          {/* Total pedidos */}
          <div className='bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-6 border border-green-200 dark:border-green-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-green-600 dark:text-green-400'>Total pedidos</p>
                <p className='text-2xl font-bold text-green-900 dark:text-green-100 mt-1'>
                  {orders.length}
                </p>
                <p className='text-xs text-green-700 dark:text-green-300 mt-1'>
                  Histórico
                </p>
              </div>
              <div className='bg-green-500 bg-opacity-10 p-3 rounded-lg'>
                <ShoppingCart className='h-6 w-6 text-green-600 dark:text-green-400' />
              </div>
            </div>
          </div>

          {/* Direcciones guardadas */}
          <div className='bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-6 border border-purple-200 dark:border-purple-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-purple-600 dark:text-purple-400'>Direcciones</p>
                <p className='text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1'>
                  {addresses.length}
                </p>
                <p className='text-xs text-purple-700 dark:text-purple-300 mt-1'>
                  Guardadas
                </p>
              </div>
              <div className='bg-purple-500 bg-opacity-10 p-3 rounded-lg'>
                <MapPin className='h-6 w-6 text-purple-600 dark:text-purple-400' />
              </div>
            </div>
          </div>

          {/* Favoritos */}
          <div className='bg-gradient-to-br from-red-50 to-pink-100 dark:from-red-900/30 dark:to-pink-800/30 rounded-xl p-6 border border-red-200 dark:border-red-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-red-600 dark:text-red-400'>Favoritos</p>
                <p className='text-2xl font-bold text-red-900 dark:text-red-100 mt-1'>
                  0
                </p>
                <p className='text-xs text-red-700 dark:text-red-300 mt-1'>
                  Seleccionados
                </p>
              </div>
              <div className='bg-red-500 bg-opacity-10 p-3 rounded-lg'>
                <Heart className='h-6 w-6 text-red-600 dark:text-red-400' />
              </div>
            </div>
          </div>
        </div>

        {/* Sección de pedidos recientes */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8'>
          {/* Pedidos recientes */}
          <div className='bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2'>
                <Clock className='h-5 w-5' />
                Mis Pedidos Recientes
              </h3>
              <Link href='/orders' className='text-sm text-blue-600 dark:text-blue-400 hover:underline'>
                Ver todos
              </Link>
            </div>
            <div className='space-y-3'>
              {loading ? (
                <div className='animate-pulse space-y-3'>
                  {[1, 2, 3].map(i => (
                    <div key={i} className='h-16 bg-gray-100 dark:bg-gray-700 rounded'></div>
                  ))}
                </div>
              ) : orders.length > 0 ? (
                orders.slice(0, 3).map(order => (
                  <div key={order.id} className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'>
                    <div className='flex items-center gap-3'>
                      <div className={`p-2 rounded-lg ${
                        order.status === 'delivered' ? 'bg-green-100 dark:bg-green-900/30' :
                        order.status === 'shipped' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        'bg-amber-100 dark:bg-amber-900/30'
                      }`}>
                        {order.status === 'delivered' ? (
                          <CheckCircle className='h-5 w-5 text-green-600 dark:text-green-400' />
                        ) : order.status === 'shipped' ? (
                          <Truck className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                        ) : (
                          <Clock className='h-5 w-5 text-amber-600 dark:text-amber-400' />
                        )}
                      </div>
                      <div>
                        <p className='text-sm font-medium text-gray-900 dark:text-white'>
                          Orden #{order.id}
                        </p>
                        <p className='text-xs text-gray-500 dark:text-gray-400'>
                          {new Date(order.createdAt).toLocaleDateString('es-ES', { 
                            day: '2-digit', 
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <p className='text-sm font-medium text-gray-900 dark:text-white'>
                        ${order.total.toFixed(2)}
                      </p>
                      <p className='text-xs text-gray-500 dark:text-gray-400 capitalize'>
                        {order.status === 'pending' ? 'Pendiente' :
                         order.status === 'processing' ? 'Procesando' :
                         order.status === 'shipped' ? 'Enviado' :
                         order.status === 'delivered' ? 'Entregado' : order.status}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className='text-center py-8'>
                  <ShoppingCart className='h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3' />
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    ¡Aún no tienes pedidos!
                  </p>
                  <Link href='/' className='inline-flex items-center gap-2 mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline'>
                    <ShoppingCart className='h-4 w-4' />
                    Comprar ahora
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Beneficios y confianza */}
          <div className='bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-700'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2'>
              <Shield className='h-5 w-5 text-green-600' />
              Compra con Confianza
            </h3>
            <div className='space-y-4'>
              <div className='flex items-start gap-3'>
                <CheckCircle className='h-5 w-5 text-green-600 mt-0.5 flex-shrink-0' />
                <div>
                  <p className='text-sm font-medium text-gray-900 dark:text-white'>
                    Envío Garantizado
                  </p>
                  <p className='text-xs text-gray-600 dark:text-gray-400'>
                    Seguimiento en tiempo real y entrega segura
                  </p>
                </div>
              </div>
              <div className='flex items-start gap-3'>
                <CreditCard className='h-5 w-5 text-green-600 mt-0.5 flex-shrink-0' />
                <div>
                  <p className='text-sm font-medium text-gray-900 dark:text-white'>
                    Pago Seguro
                  </p>
                  <p className='text-xs text-gray-600 dark:text-gray-400'>
                    Protección 100% en todas tus compras
                  </p>
                </div>
              </div>
              <div className='flex items-start gap-3'>
                <HeadphonesIcon className='h-5 w-5 text-green-600 mt-0.5 flex-shrink-0' />
                <div>
                  <p className='text-sm font-medium text-gray-900 dark:text-white'>
                    Soporte 24/7
                  </p>
                  <p className='text-xs text-gray-600 dark:text-gray-400'>
                    Estamos aquí para ayudarte siempre
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div>
          <h2 className='text-xl font-semibold text-gray-900 dark:text-white mb-4'>
            Acciones Rápidas
          </h2>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <Link
              href='/orders'
              className='bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center transition-colors group flex flex-col items-center justify-center min-h-[100px]'
            >
              <Package className='h-6 w-6 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-2' />
              <span className='block text-sm font-medium text-gray-900 dark:text-white'>
                Mis Pedidos
              </span>
            </Link>
            
            <Link
              href='/addresses'
              className='bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center transition-colors group flex flex-col items-center justify-center min-h-[100px]'
            >
              <MapPin className='h-6 w-6 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-2' />
              <span className='block text-sm font-medium text-gray-900 dark:text-white'>
                Direcciones
              </span>
            </Link>
            
            <Link
              href='/wishlist'
              className='bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center transition-colors group flex flex-col items-center justify-center min-h-[100px]'
            >
              <Heart className='h-6 w-6 text-gray-600 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 mb-2' />
              <span className='block text-sm font-medium text-gray-900 dark:text-white'>
                Favoritos
              </span>
            </Link>
            
            <Link
              href='/'
              className='bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center transition-colors group flex flex-col items-center justify-center min-h-[100px]'
            >
              <ShoppingCart className='h-6 w-6 text-gray-600 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 mb-2' />
              <span className='block text-sm font-medium text-gray-900 dark:text-white'>
                Comprar
              </span>
            </Link>
          </div>
        </div>

        {/* Mensaje de confianza final */}
        <div className='mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700'>
          <div className='flex items-center gap-3'>
            <Shield className='h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0' />
            <div>
              <p className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                Tu seguridad es nuestra prioridad
              </p>
              <p className='text-xs text-blue-700 dark:text-blue-300 mt-1'>
                Todos tus datos están protegidos con encriptación de última generación. 
                Compra con total tranquilidad.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
