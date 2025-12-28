import { Suspense } from 'react';
import { auth } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { getDashboardStats } from '@/lib/actions/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { MercadoLibreStatus } from '@/components/admin/MercadoLibreStatus';
import { MercadoPagoStatus } from '@/components/admin/MercadoPagoStatus';
import { McpDiagnosticsPanel } from '@/components/admin/McpDiagnosticsPanel';
import {
  Users as UsersIcon,
  ShoppingCart,
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Bell,
} from 'lucide-react';
import { checkSystemStatus, getStatusColor } from '@/lib/actions/system-status';

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; isPositive: boolean };
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {trend && (
          <p className='text-xs text-muted-foreground flex items-center'>
            {trend.isPositive ? (
              <TrendingUp className='h-3 w-3 mr-1 text-green-500' />
            ) : (
              <TrendingDown className='h-3 w-3 mr-1 text-red-500' />
            )}
            {trend.value}% desde el mes pasado
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className='grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-4 w-4' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-8 w-16 mb-2' />
            <Skeleton className='h-3 w-32' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function DashboardContent() {
  const dashboardData = await getDashboardStats();
  const systemStatus = await checkSystemStatus();

  return (
    <div className='space-y-8'>
      <div>
        <h2 className='text-3xl font-bold tracking-tight'>Dashboard</h2>
        <p className='text-muted-foreground'>
          Bienvenido al panel de administración. Aquí puedes gestionar tu tienda.
        </p>
      </div>

      <div className='grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        <StatCard
          title='Total Usuarios'
          value={dashboardData.stats.totalUsers}
          icon={UsersIcon}
          trend={{
            value: Math.abs(dashboardData.stats.ordersTrend),
            isPositive: dashboardData.stats.ordersTrend >= 0,
          }}
        />
        <StatCard
          title='Total Productos'
          value={dashboardData.stats.totalProducts}
          icon={Package}
        />
        <StatCard
          title='Total Pedidos'
          value={dashboardData.stats.totalOrders}
          icon={ShoppingCart}
          trend={{
            value: Math.abs(dashboardData.stats.ordersTrend),
            isPositive: dashboardData.stats.ordersTrend >= 0,
          }}
        />
        <StatCard
          title='Ingresos Totales'
          value={`$${dashboardData.stats.totalRevenue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          trend={{
            value: Math.abs(dashboardData.stats.revenueTrend),
            isPositive: dashboardData.stats.revenueTrend >= 0,
          }}
        />
        <div className='sm:col-span-2 lg:col-span-1 xl:col-span-2'>
          <MercadoLibreStatus />
        </div>
        <div className='sm:col-span-2 lg:col-span-1 xl:col-span-2'>
          <MercadoPagoStatus />
        </div>
        <div className='sm:col-span-2 lg:col-span-2 xl:col-span-4'>
          <McpDiagnosticsPanel />
        </div>
      </div>

      {/* Enlaces Rápidos */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración Rápida</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            <Link
              href='/admin/business-settings'
              className='flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition-colors'
            >
              <Package className='h-4 w-4' />
              <span className='text-sm font-medium'>Configurar Negocio</span>
            </Link>
            <Link
              href='/admin/products'
              className='flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition-colors'
            >
              <Package className='h-4 w-4' />
              <span className='text-sm font-medium'>Gestionar Productos</span>
            </Link>
            <Link
              href='/admin/orders'
              className='flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition-colors'
            >
              <ShoppingCart className='h-4 w-4' />
              <span className='text-sm font-medium'>Ver Pedidos</span>
            </Link>
            <Link
              href='/admin/categories'
              className='flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition-colors'
            >
              <UsersIcon className='h-4 w-4' />
              <span className='text-sm font-medium'>Categorías</span>
            </Link>
          </div>

          <div className='grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-4'>
            <Link
              href='/admin/mercadolibre'
              className='flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition-colors'
            >
              <UsersIcon className='h-4 w-4' />
              <span className='text-sm font-medium'>MercadoLibre</span>
            </Link>
            <Link
              href='/admin/mercadopago'
              className='flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition-colors'
            >
              <DollarSign className='h-4 w-4' />
              <span className='text-sm font-medium'>MercadoPago</span>
            </Link>
            <Link
              href='/admin/shipments'
              className='flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition-colors'
            >
              <Package className='h-4 w-4' />
              <span className='text-sm font-medium'>Envíos</span>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Notificaciones */}
      {dashboardData.stats.unreadNotifications > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Bell className='h-5 w-5' />
              Notificaciones Recientes
              {dashboardData.stats.unreadNotifications > 0 && (
                <Badge variant='destructive' className='ml-2'>
                  {dashboardData.stats.unreadNotifications}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              {dashboardData.recentOrders.map((order) => (
                <div key={order.id} className='p-3 border rounded-lg'>
                  <p className='font-medium'>Pedido #{order.id}</p>
                  <p className='text-sm text-muted-foreground'>Total: ${order.total}</p>
                  <p className='text-sm'>Estado: {order.status}</p>
                </div>
              ))}
            </div>
            {dashboardData.stats.unreadNotifications > 5 && (
              <div className='mt-4 text-center'>
                <Link
                  href='/admin/notifications'
                  className='text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
                >
                  Ver todas las notificaciones ({dashboardData.stats.unreadNotifications})
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Estado del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            <div className='flex justify-between'>
              <span className='text-sm'>Base de Datos</span>
              <span className={`text-sm ${getStatusColor(systemStatus.database.status)}`}>
                {systemStatus.database.message}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-sm'>MercadoLibre API</span>
              <span className={`text-sm ${getStatusColor(systemStatus.mercadolibre.status)}`}>
                {systemStatus.mercadolibre.message}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-sm'>Pagos</span>
              <span className={`text-sm ${getStatusColor(systemStatus.payments.status)}`}>
                {systemStatus.payments.message}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function AdminDashboard() {
  const session = await auth();

  if (!session || session.user.role !== 'admin') {
    redirect('/');
  }

  return (
    <Suspense fallback={<StatsSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
