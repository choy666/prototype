import { NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { orders } from '@/lib/schema'
import { sum, count, sql } from 'drizzle-orm'

export async function GET() {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Total pedidos que cuentan como ventas
    const [orderCount] = await db.select({ count: count() }).from(orders).where(
      sql`${orders.status} IN ('paid', 'shipped', 'delivered')`
    )

    // Total ingresos de pedidos que cuentan como ventas
    const [revenueResult] = await db
      .select({ total: sum(orders.total) })
      .from(orders)
      .where(
        sql`${orders.status} IN ('paid', 'shipped', 'delivered')`
      )

    const totalSales = Number(revenueResult?.total ?? 0)
    const totalOrders = orderCount.count

    return NextResponse.json({
      totalSales,
      totalOrders
    })
  } catch (error) {
    console.error('Error fetching totals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
