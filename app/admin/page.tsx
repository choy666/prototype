import { Suspense } from 'react'
import { auth } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { count, sum, eq, gte, lte, and } from 'drizzle-orm'
import { users, products, orders } from '@/lib/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users as UsersIcon,
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { checkSystemStatus, getStatusColor } from '@/lib/actions/system-status'

async function getStats() {
  // Total usuarios
  const [userCount] = await db.select({ count: count() }).from(users)

  // Total productos activos (stock > 0)
  const [productCount] = await db.select({ count: count() }).from(products).where(gte(products.stock, 1))

  // Total pedidos
  const [orderCount] = await db.select({ count: count() }).from(orders)

  // Calcular ingresos totales de pedidos pagados
  const [revenueResult] = await db
    .select({ total: sum(orders.total) })
    .from(orders)
    .where(eq(orders.status, 'paid'))

  const revenue = Number(revenueResult?.total ?? 0)

  // Calcular tendencias para usuarios (último mes vs mes anterior)
  const now = new Date()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [lastMonthUsers] = await db
    .select({ count: count() })
    .from(users)
    .where(
      and(
        gte(users.createdAt, lastMonthStart),
        lte(users.createdAt, lastMonthEnd)
      )
    )

  const [currentMonthUsers] = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, currentMonthStart))

  const lastMonthUserCount = lastMonthUsers.count
  const currentMonthUserCount = currentMonthUsers.count
  const userTrend = lastMonthUserCount > 0 ? ((currentMonthUserCount - lastMonthUserCount) / lastMonthUserCount) * 100 : (currentMonthUserCount > 0 ? 100 : 0)

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

  // Tendencias para pedidos (último mes vs mes anterior)
  const [lastMonthOrders] = await db
    .select({ count: count() })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, lastMonthStart),
        lte(orders.createdAt, lastMonthEnd)
      )
    )

  const [currentMonthOrders] = await db
    .select({ count: count() })
    .from(orders)
    .where(gte(orders.createdAt, currentMonthStart))

  const lastMonthOrderCount = lastMonthOrders.count
  const currentMonthOrderCount = currentMonthOrders.count
  const orderTrend = lastMonthOrderCount > 0 ? ((currentMonthOrderCount - lastMonthOrderCount) / lastMonthOrderCount) * 100 : (currentMonthOrderCount > 0 ? 100 : 0)

  // Tendencias para ingresos (último mes vs mes anterior)
  const [lastMonthRevenue] = await db
    .select({ total: sum(orders.total) })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'paid'),
        gte(orders.createdAt, lastMonthStart),
        lte(orders.createdAt, lastMonthEnd)
      )
    )

  const [currentMonthRevenue] = await db
    .select({ total: sum(orders.total) })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'paid'),
        gte(orders.createdAt, currentMonthStart)
      )
    )

  const lastMonthRevenueTotal = Number(lastMonthRevenue?.total ?? 0)
  const currentMonthRevenueTotal = Number(currentMonthRevenue?.total ?? 0)
  const revenueTrend = lastMonthRevenueTotal > 0 ? ((currentMonthRevenueTotal - lastMonthRevenueTotal) / lastMonthRevenueTotal) * 100 : (currentMonthRevenueTotal > 0 ? 100 : 0)

  return {
    users: userCount.count,
    products: productCount.count,
    orders: orderCount.count,
    revenue,
    userTrend: {
      value: Math.abs(userTrend),
      isPositive: userTrend >= 0
    },
    productTrend: {
      value: Math.abs(productTrend),
      isPositive: productTrend >= 0
    },
    orderTrend: {
      value: Math.abs(orderTrend),
      isPositive: orderTrend >= 0
    },
    revenueTrend: {
      value: Math.abs(revenueTrend),
      isPositive: revenueTrend >= 0
    }
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
          value={`$${stats.revenue.toLocaleString()}`}
          icon={DollarSign}
          trend={stats.revenueTrend}
        />
      </div>

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
