'use client';

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LogOut, 
  ShoppingCart, 
  Package, 
  Users, 
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Truck,
  RefreshCw,
  Eye
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useCartClearOnSuccess } from '@/hooks/useCartClearOnSuccess';
import { getDashboardMetrics, getDashboardAlerts, getMercadoLibreStats } from '@/lib/actions/dashboard';

interface RecentOrder {
  id: number;
  total: number;
  status: string;
  createdAt: Date;
  email: string | null;
}

interface TopProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
  soldCount: number;
}

interface DashboardMetrics {
  salesToday: number;
  revenueToday: number;
  revenueMonth: number;
  pendingOrders: number;
  totalOrders: number;
  totalProducts: number;
  outOfStock: number;
  totalUsers: number;
  me2Incompatible: number;
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
}

interface Alert {
  type: 'warning' | 'info' | 'error';
  title: string;
  description: string;
  items: string[];
}

interface MercadoLibreStats {
  totalSynced: number;
  activePublications: number;
  totalMLSales: number;
  lastSync: Date | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [mlStats, setMlStats] = useState<MercadoLibreStats | null>(null);
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

  // Cargar métricas del dashboard
  const loadMetrics = async () => {
    try {
      const result = await getDashboardMetrics();
      if (result.success && result.metrics) {
        setMetrics(result.metrics);
      }
      
      const alertsData = await getDashboardAlerts();
      setAlerts(alertsData as Alert[]);
      
      // Cargar estadísticas de Mercado Libre
      const mlData = await getMercadoLibreStats();
      if (mlData) {
        setMlStats(mlData);
      }
    } catch (error) {
      console.error('Error al cargar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Efecto para cargar datos al montar
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'admin') {
      loadMetrics();
    }
  }, [status, session]);

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

  // Efecto para manejar redirecciones y limpieza de URL después de pago exitoso
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard');
      return;
    }

    // Limpiar parámetros de URL después de procesar el pago exitoso
    if (isPaymentSuccessful && paymentInfo.paymentId) {
      // Dar un poco de tiempo para que el hook procese la limpieza del carrito
      const timer = setTimeout(() => {
        cleanUrlParams();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [status, router, isPaymentSuccessful, paymentInfo.paymentId, cleanUrlParams]);

  // Estado de carga
  if (status === 'loading' || !session?.user) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
      </div>
    );
  }

  // Si el usuario no tiene el rol adecuado, redirigir
  if (session.user.role !== 'admin' && session.user.role !== 'user') {
    router.push('/unauthorized');
    return null;
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-md p-6'>
        <div className='flex justify-between items-center mb-6'>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>Panel de Control</h1>
          <button
            onClick={handleSignOut}
            className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-lg border border-red-200 dark:border-red-800 transition-colors'
          >
            <LogOut className='h-4 w-4' />
          </button>
        </div>

        <div className='mb-6'>
          <p className='text-gray-600 dark:text-gray-300'>
            ¡Bienvenido de vuelta,{' '}
            <span className='font-semibold'>{session.user.name || 'Usuario'}</span>!
          </p>
          <p className='text-sm text-gray-500 dark:text-gray-400'>
            {session.user.role === 'admin' ? 'Administrador' : 'Usuario'}
          </p>
        </div>

        {/* KPIs - Fila superior con 4 métricas */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
          {/* Ventas hoy */}
          <div className='bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-6 border border-blue-200 dark:border-blue-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-blue-600 dark:text-blue-400'>Ventas hoy</p>
                <p className='text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1'>
                  {loading ? '-' : metrics?.salesToday || 0}
                </p>
                <p className='text-xs text-blue-700 dark:text-blue-300 mt-1'>
                  ${loading ? '0.00' : (metrics?.revenueToday || 0).toFixed(2)}
                </p>
              </div>
              <div className='bg-blue-500 bg-opacity-10 p-3 rounded-lg'>
                <ShoppingCart className='h-6 w-6 text-blue-600 dark:text-blue-400' />
              </div>
            </div>
          </div>

          {/* Pedidos pendientes */}
          <div className='bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 rounded-xl p-6 border border-amber-200 dark:border-amber-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-amber-600 dark:text-amber-400'>Pedidos pendientes</p>
                <p className='text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1'>
                  {loading ? '-' : metrics?.pendingOrders || 0}
                </p>
                <p className='text-xs text-amber-700 dark:text-amber-300 mt-1'>
                  Total: {loading ? '0' : metrics?.totalOrders || 0}
                </p>
              </div>
              <div className='bg-amber-500 bg-opacity-10 p-3 rounded-lg'>
                <Package className='h-6 w-6 text-amber-600 dark:text-amber-400' />
              </div>
            </div>
          </div>

          {/* Productos sin stock */}
          <div className='bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 rounded-xl p-6 border border-red-200 dark:border-red-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-red-600 dark:text-red-400'>Bajo stock</p>
                <p className='text-2xl font-bold text-red-900 dark:text-red-100 mt-1'>
                  {loading ? '-' : metrics?.outOfStock || 0}
                </p>
                <p className='text-xs text-red-700 dark:text-red-300 mt-1'>
                  Menos de 5 unidades
                </p>
              </div>
              <div className='bg-red-500 bg-opacity-10 p-3 rounded-lg'>
                <AlertTriangle className='h-6 w-6 text-red-600 dark:text-red-400' />
              </div>
            </div>
          </div>

          {/* Ingresos del mes */}
          <div className='bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-6 border border-green-200 dark:border-green-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-green-600 dark:text-green-400'>Ingresos mes</p>
                <p className='text-2xl font-bold text-green-900 dark:text-green-100 mt-1'>
                  ${loading ? '0.00' : (metrics?.revenueMonth || 0).toFixed(2)}
                </p>
                <p className='text-xs text-green-700 dark:text-green-300 mt-1'>
                  {new Date().toLocaleDateString('es-ES', { month: 'long' })}
                </p>
              </div>
              <div className='bg-green-500 bg-opacity-10 p-3 rounded-lg'>
                <DollarSign className='h-6 w-6 text-green-600 dark:text-green-400' />
              </div>
            </div>
          </div>
        </div>

        {/* Alertas si existen */}
        {alerts.length > 0 && (
          <div className='mb-8 space-y-3'>
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`rounded-lg p-4 border ${
                  alert.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700'
                    : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
                }`}
              >
                <div className='flex items-start gap-3'>
                  <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                    alert.type === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                  }`} />
                  <div className='flex-1'>
                    <h4 className={`font-medium ${
                      alert.type === 'warning' ? 'text-amber-800 dark:text-amber-200' : 'text-blue-800 dark:text-blue-200'
                    }`}>
                      {alert.title}
                    </h4>
                    <p className={`text-sm mt-1 ${
                      alert.type === 'warning' ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'
                    }`}>
                      {alert.description}
                    </p>
                    {alert.items.length > 0 && (
                      <ul className='text-xs mt-2 space-y-1'>
                        {alert.items.map((item, i) => (
                          <li key={i} className={alert.type === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}>
                            • {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid 2x2: Pedidos recientes, Productos populares, Estado ML, Métricas adicionales */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8'>
          {/* Pedidos recientes */}
          <div className='bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>Pedidos recientes</h3>
              <Link href='/orders' className='text-sm text-blue-600 dark:text-blue-400 hover:underline'>
                Ver todos
              </Link>
            </div>
            <div className='space-y-3'>
              {loading ? (
                <div className='animate-pulse space-y-3'>
                  {[1, 2, 3].map(i => (
                    <div key={i} className='h-12 bg-gray-100 dark:bg-gray-700 rounded'></div>
                  ))}
                </div>
              ) : metrics?.recentOrders && metrics.recentOrders.length > 0 ? (
                metrics.recentOrders.map(order => (
                  <div key={order.id} className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg'>
                    <div>
                      <p className='text-sm font-medium text-gray-900 dark:text-white'>
                        Orden #{order.id}
                      </p>
                      <p className='text-xs text-gray-500 dark:text-gray-400'>
                        {order.email || 'Sin email'}
                      </p>
                    </div>
                    <div className='text-right'>
                      <p className='text-sm font-medium text-gray-900 dark:text-white'>
                        ${order.total.toFixed(2)}
                      </p>
                      <p className='text-xs text-gray-500 dark:text-gray-400 capitalize'>
                        {order.status}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className='text-sm text-gray-500 dark:text-gray-400 text-center py-4'>
                  No hay pedidos recientes
                </p>
              )}
            </div>
          </div>

          {/* Productos más vendidos */}
          <div className='bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>Productos populares</h3>
              <Link href='/admin/products' className='text-sm text-blue-600 dark:text-blue-400 hover:underline'>
                Gestionar
              </Link>
            </div>
            <div className='space-y-3'>
              {loading ? (
                <div className='animate-pulse space-y-3'>
                  {[1, 2, 3].map(i => (
                    <div key={i} className='h-12 bg-gray-100 dark:bg-gray-700 rounded'></div>
                  ))}
                </div>
              ) : metrics?.topProducts && metrics.topProducts.length > 0 ? (
                metrics.topProducts.map(product => (
                  <div key={product.id} className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg'>
                    <div className='flex-1'>
                      <p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
                        {product.name}
                      </p>
                      <p className='text-xs text-gray-500 dark:text-gray-400'>
                        Stock: {product.stock}
                      </p>
                    </div>
                    <div className='text-right ml-3'>
                      <p className='text-sm font-medium text-gray-900 dark:text-white'>
                        ${product.price.toFixed(2)}
                      </p>
                      <p className='text-xs text-green-600 dark:text-green-400'>
                        {product.soldCount} vendidos
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className='text-sm text-gray-500 dark:text-gray-400 text-center py-4'>
                  No hay productos con ventas
                </p>
              )}
            </div>
          </div>

          {/* Estado Mercado Libre */}
          <div className='bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-700'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2'>
                <span className='text-xl'>📦</span> Mercado Libre
              </h3>
              <Link href='/admin/mercadolibre' className='text-sm text-blue-600 dark:text-blue-400 hover:underline'>
                Configurar
              </Link>
            </div>
            <div className='space-y-4'>
              {loading ? (
                <div className='animate-pulse space-y-3'>
                  {[1, 2, 3].map(i => (
                    <div key={i} className='h-8 bg-gray-100 dark:bg-gray-700 rounded'></div>
                  ))}
                </div>
              ) : mlStats ? (
                <>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600 dark:text-gray-400'>Productos sincronizados</span>
                    <span className='text-sm font-medium text-gray-900 dark:text-white'>
                      {mlStats.totalSynced}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600 dark:text-gray-400'>Publicaciones activas</span>
                    <span className='text-sm font-medium text-gray-900 dark:text-white'>
                      {mlStats.activePublications}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600 dark:text-gray-400'>Total ventas ML</span>
                    <span className='text-sm font-medium text-gray-900 dark:text-white'>
                      {mlStats.totalMLSales}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600 dark:text-gray-400'>Última sincronización</span>
                    <span className='text-sm font-medium text-gray-900 dark:text-white'>
                      {mlStats.lastSync 
                        ? new Date(mlStats.lastSync).toLocaleDateString('es-ES', { 
                            day: '2-digit', 
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Nunca'
                      }
                    </span>
                  </div>
                </>
              ) : (
                <p className='text-sm text-gray-500 dark:text-gray-400 text-center py-4'>
                  No se pudo obtener información de Mercado Libre
                </p>
              )}
            </div>
          </div>

          {/* Métricas adicionales */}
          <div className='bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>Resumen general</h3>
            <div className='grid grid-cols-2 gap-4'>
              <div className='text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg'>
                <Users className='h-6 w-6 mx-auto text-gray-600 dark:text-gray-400 mb-1' />
                <p className='text-lg font-bold text-gray-900 dark:text-white'>
                  {loading ? '-' : metrics?.totalUsers || 0}
                </p>
                <p className='text-xs text-gray-600 dark:text-gray-400'>Usuarios</p>
              </div>
              <div className='text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg'>
                <Package className='h-6 w-6 mx-auto text-gray-600 dark:text-gray-400 mb-1' />
                <p className='text-lg font-bold text-gray-900 dark:text-white'>
                  {loading ? '-' : metrics?.totalProducts || 0}
                </p>
                <p className='text-xs text-gray-600 dark:text-gray-400'>Productos</p>
              </div>
              <div className='text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg'>
                <Truck className='h-6 w-6 mx-auto text-gray-600 dark:text-gray-400 mb-1' />
                <p className='text-lg font-bold text-gray-900 dark:text-white'>
                  {loading ? '-' : metrics?.me2Incompatible || 0}
                </p>
                <p className='text-xs text-gray-600 dark:text-gray-400'>No compatibles ME2</p>
              </div>
              <div className='text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg'>
                <TrendingUp className='h-6 w-6 mx-auto text-gray-600 dark:text-gray-400 mb-1' />
                <p className='text-lg font-bold text-gray-900 dark:text-white'>
                  ${loading ? '0' : ((metrics?.revenueToday || 0) * 30).toFixed(0)}
                </p>
                <p className='text-xs text-gray-600 dark:text-gray-400'>Proyección mensual</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sección de Acciones Rápidas */}
        <div>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
              Acciones Rápidas
            </h2>
            <button
              onClick={loadMetrics}
              className='flex items-center gap-2 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors'
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <Link
              href='/admin/products'
              className='bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center transition-colors group'
            >
              <Package className='h-6 w-6 mx-auto text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-2' />
              <span className='block text-sm font-medium text-gray-900 dark:text-white'>
                Productos
              </span>
            </Link>
            
            <Link
              href='/admin/orders'
              className='bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center transition-colors group'
            >
              <ShoppingCart className='h-6 w-6 mx-auto text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-2' />
              <span className='block text-sm font-medium text-gray-900 dark:text-white'>
                Pedidos
              </span>
            </Link>
            
            <Link
              href='/admin/categories'
              className='bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center transition-colors group'
            >
              <Eye className='h-6 w-6 mx-auto text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-2' />
              <span className='block text-sm font-medium text-gray-900 dark:text-white'>
                Categorías
              </span>
            </Link>
            
            <button
              className='bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center transition-colors group'
              onClick={handleSignOut}
            >
              <LogOut className='h-6 w-6 mx-auto text-gray-600 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 mb-2' />
              <span className='block text-sm font-medium text-red-600 dark:text-red-400'>
                Cerrar Sesión
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
