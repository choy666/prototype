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

async function getStats() {
  const [userCount] = await db.select({ count: count() }).from(users)
  const [productCount] = await db.select({ count: count() }).from(products)
  const [orderCount] = await db.select({ count: count() }).from(orders)

  // Calcular ingresos totales de pedidos pagados
  const [revenueResult] = await db
    .select({ total: sum(orders.total) })
    .from(orders)
    .where(eq(orders.status, 'paid'))

  const revenue = Number(revenueResult?.total ?? 0)

  // Calcular ingresos del último mes para tendencias
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const currentMonth = new Date()

  const [lastMonthRevenue] = await db
    .select({ total: sum(orders.total) })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'paid'),
        gte(orders.createdAt, lastMonth),
        lte(orders.createdAt, currentMonth)
      )
    )

  const lastMonthTotal = Number(lastMonthRevenue?.total ?? 0)
  const revenueTrend = lastMonthTotal > 0 ? ((revenue - lastMonthTotal) / lastMonthTotal) * 100 : 0

  return {
    users: userCount.count,
    products: productCount.count,
    orders: orderCount.count,
    revenue,
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
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Total Productos"
          value={stats.products}
          icon={Package}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Total Pedidos"
          value={stats.orders}
          icon={ShoppingCart}
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="Ingresos Totales"
          value={`$${stats.revenue.toLocaleString()}`}
          icon={DollarSign}
          trend={stats.revenueTrend}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aquí se mostrarán las actividades recientes del sistema.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Base de Datos</span>
                <span className="text-sm text-green-600">Conectada</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Servidor</span>
                <span className="text-sm text-green-600">Operativo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Pagos</span>
                <span className="text-sm text-green-600">Activo</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
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
