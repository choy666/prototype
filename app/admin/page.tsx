import { Suspense } from 'react'
import { auth } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { count, sum, eq, gte, lte, and, desc, sql } from 'drizzle-orm'
import { users, products, orders, notifications, mercadopagoPayments } from '@/lib/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { MercadoLibreStatus } from '@/components/admin/MercadoLibreStatus'
import {
  Users as UsersIcon,
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Bell,
  AlertCircle,
  Eye,
  ShieldCheck
} from 'lucide-react'
import { checkSystemStatus, getStatusColor } from '@/lib/actions/system-status'

async function getStats() {
  // Total usuarios
  const [userCount] = await db.select({ count: count() }).from(users)

  // Total productos activos (stock > 0)
  const [productCount] = await db.select({ count: count() }).from(products).where(gte(products.stock, 1))

  // Total pedidos
  const [orderCount] = await db.select({ count: count() }).from(orders).where(
    and(
      sql`${orders.status} IN ('paid', 'shipped', 'delivered')`,
      sql`${orders.status} NOT IN ('cancelled', 'rejected')`
    )
  )

  // Pagos que requieren verificación manual (HMAC falló)
  const [manualVerificationCount] = await db
    .select({ count: count() })
    .from(mercadopagoPayments)
    .where(eq(mercadopagoPayments.requiresManualVerification, true))

  // Calcular ingresos totales de pedidos con status logístico
  const [revenueResult] = await db
    .select({ total: sum(orders.total) })
    .from(orders)
    .where(
      and(
        sql`${orders.status} IN ('paid', 'shipped', 'delivered')`,
        sql`${orders.status} NOT IN ('cancelled', 'rejected')`
      )
    )

  const revenue = Number(revenueResult?.total ?? 0)

  // Calcular tendencias para usuarios (total hasta fin del mes pasado vs total hasta ahora)
  const now = new Date()
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [lastMonthUsers] = await db
    .select({ count: count() })
    .from(users)
    .where(lte(users.createdAt, lastMonthEnd))

  const lastMonthUserCount = lastMonthUsers.count
  const currentUserCount = userCount.count
  const userTrend = lastMonthUserCount > 0 ? ((currentUserCount - lastMonthUserCount) / lastMonthUserCount) * 100 : (currentUserCount > 0 ? 100 : 0)

  // Tendencias para productos (último mes vs mes anterior)
  const [lastMonthProducts] = await db
    .select({ count: count() })
    .from(products)
    .where(
      and(
        gte(products.created_at, lastMonthStart),
        lte(products.created_at, lastMonthEnd),
        gte(products.stock, 1)
      )
    )

  const [currentMonthProducts] = await db
    .select({ count: count() })
    .from(products)
    .where(
      and(
        gte(products.created_at, currentMonthStart),
        gte(products.stock, 1)
      )
    )

  const lastMonthProductCount = lastMonthProducts.count
  const currentMonthProductCount = currentMonthProducts.count
  const productTrend = lastMonthProductCount > 0 ? ((currentMonthProductCount - lastMonthProductCount) / lastMonthProductCount) * 100 : (currentMonthProductCount > 0 ? 100 : 0)

  // Tendencias para pedidos (total hasta fin del mes pasado vs total hasta ahora)
  const [lastMonthOrders] = await db
    .select({ count: count() })
    .from(orders)
    .where(
      and(
        sql`${orders.status} IN ('paid', 'shipped', 'delivered')`,
        sql`${orders.status} NOT IN ('cancelled', 'rejected')`,
        lte(orders.createdAt, lastMonthEnd)
      )
    )

  const lastMonthOrderCount = lastMonthOrders.count
  const currentOrderCount = orderCount.count
  const orderTrend = lastMonthOrderCount > 0 ? ((currentOrderCount - lastMonthOrderCount) / lastMonthOrderCount) * 100 : (currentOrderCount > 0 ? 100 : 0)

  // Tendencias para ingresos (total hasta fin del mes pasado vs total hasta ahora)
  const [lastMonthRevenue] = await db
    .select({ total: sum(orders.total) })
    .from(orders)
    .where(
      and(
        sql`${orders.status} IN ('paid', 'shipped', 'delivered')`,
        sql`${orders.status} NOT IN ('cancelled', 'rejected')`,
        lte(orders.createdAt, lastMonthEnd)
      )
    )

  const lastMonthRevenueTotal = Number(lastMonthRevenue?.total ?? 0)
  const currentRevenueTotal = revenue
  const revenueTrend = lastMonthRevenueTotal > 0 ? ((currentRevenueTotal - lastMonthRevenueTotal) / lastMonthRevenueTotal) * 100 : (currentRevenueTotal > 0 ? 100 : 0)

  // Obtener notificaciones recientes (últimas 5 no leídas)
  const recentNotifications = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      data: notifications.data,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.isRead, false))
    .orderBy(desc(notifications.createdAt))
    .limit(5)

  // Contar notificaciones no leídas
  const [unreadCount] = await db
    .select({ count: count() })
    .from(notifications)
    .where(eq(notifications.isRead, false))

  return {
    users: userCount.count,
    products: productCount.count,
    orders: orderCount.count,
    revenue,
    manualVerificationCount: manualVerificationCount.count,
    userTrend: {
      value: parseFloat(Math.abs(userTrend).toFixed(2)),
      isPositive: userTrend >= 0
    },
    productTrend: {
      value: parseFloat(Math.abs(productTrend).toFixed(2)),
      isPositive: productTrend >= 0
    },
    orderTrend: {
      value: parseFloat(Math.abs(orderTrend).toFixed(2)),
      isPositive: orderTrend >= 0
    },
    revenueTrend: {
      value: parseFloat(Math.abs(revenueTrend).toFixed(2)),
      isPositive: revenueTrend >= 0
    },
    notifications: recentNotifications.map(notification => ({
      ...notification,
      data: (typeof notification.data === 'object' && notification.data !== null ? notification.data : {}) as Record<string, unknown>,
      createdAt: notification.createdAt.toISOString(),
    })),
    unreadNotificationsCount: unreadCount.count,
  }
}

function StatCard({ title, value, icon: Icon, trend }: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  trend?: { value: number; isPositive: boolean }
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground flex items-center">
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
            )}
            {trend.value}% desde el mes pasado
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function NotificationCard({ notification }: {
  notification: {
    id: number
    type: string
    title: string
    message: string
    data: Record<string, unknown>
    createdAt: string
  }
}) {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Bell className="h-4 w-4 text-blue-500" />
    }
  }

  const getOrderLink = (data: Record<string, unknown>) => {
    if (data?.orderId) {
      return `/admin/orders/${data.orderId}`
    }
    return null
  }

  const orderLink = getOrderLink(notification.data)

  return (
    <div className="flex items-start gap-3 p-3 border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 rounded-lg">
      {getNotificationIcon(notification.type)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {notification.title}
          </h4>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(notification.createdAt).toLocaleDateString('es-ES', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {notification.message}
        </p>
        {orderLink && (
          <Link
            href={orderLink}
            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mt-2"
          >
            <Eye className="h-3 w-3" />
            Ver detalles del pedido
          </Link>
        )}
      </div>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

async function DashboardContent() {
  const stats = await getStats()
  const systemStatus = await checkSystemStatus()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Bienvenido al panel de administración. Aquí puedes gestionar tu tienda.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Usuarios"
          value={stats.users}
          icon={UsersIcon}
          trend={stats.userTrend}
        />
        <StatCard
          title="Total Productos"
          value={stats.products}
          icon={Package}
          trend={stats.productTrend}
        />
        <StatCard
          title="Total Pedidos"
          value={stats.orders}
          icon={ShoppingCart}
          trend={stats.orderTrend}
        />
        <StatCard
          title="Ingresos Totales"
          value={`$${stats.revenue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          trend={stats.revenueTrend}
        />
        <MercadoLibreStatus />
      </div>

      {/* Alerta de Pagos Pendientes de Verificación Manual */}
      {stats.manualVerificationCount > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <ShieldCheck className="h-5 w-5" />
              Pagos Requieren Verificación Manual
              <Badge variant="secondary" className="ml-2 bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200">
                {stats.manualVerificationCount}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
              Hay {stats.manualVerificationCount} pago{stats.manualVerificationCount !== 1 ? 's' : ''} que fallaron la validación HMAC y requieren verificación manual antes de confirmar las órdenes.
            </p>
            <div className="flex gap-2">
              <Link
                href="/admin/payments"
                className="inline-flex items-center gap-1 text-xs bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                <Eye className="h-3 w-3" />
                Ver Pagos Pendientes
              </Link>
              <Link
                href="/admin/payments?filter=requires_manual_verification"
                className="inline-flex items-center gap-1 text-xs border border-orange-300 hover:bg-orange-100 text-orange-700 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-800/20 font-medium py-2 px-4 rounded-md transition-colors"
              >
                <AlertCircle className="h-3 w-3" />
                Ver Auditoría Completa
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notificaciones */}
      {stats.notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones Recientes
              {stats.unreadNotificationsCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {stats.unreadNotificationsCount}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.notifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))}
            </div>
            {stats.unreadNotificationsCount > 5 && (
              <div className="mt-4 text-center">
                <Link
                  href="/admin/notifications"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  Ver todas las notificaciones ({stats.unreadNotificationsCount})
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
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Base de Datos</span>
              <span className={`text-sm ${getStatusColor(systemStatus.database.status)}`}>
                {systemStatus.database.message}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Servidor</span>
              <span className={`text-sm ${getStatusColor(systemStatus.server.status)}`}>
                {systemStatus.server.message}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Pagos</span>
              <span className={`text-sm ${getStatusColor(systemStatus.payments.status)}`}>
                {systemStatus.payments.message}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function AdminDashboard() {
  const session = await auth()

  if (!session || session.user.role !== 'admin') {
    redirect('/')
  }

  return (
    <Suspense fallback={<StatsSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}
