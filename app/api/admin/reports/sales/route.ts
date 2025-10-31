import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { orders } from '@/lib/schema'
import { eq, sum, count, gte, lte, and, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'

    const now = new Date()
    let startDate: Date
    let groupBy: string

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        groupBy = 'day'
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        groupBy = 'day'
        break
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        groupBy = 'week'
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        groupBy = 'month'
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        groupBy = 'day'
    }

    let dateFormat: string
    switch (groupBy) {
      case 'day':
        dateFormat = 'YYYY-MM-DD'
        break
      case 'week':
        dateFormat = 'YYYY-IW'
        break
      case 'month':
        dateFormat = 'YYYY-MM'
        break
      default:
        dateFormat = 'YYYY-MM-DD'
    }

    const subquery = db
      .select({
        period: sql<string>`to_char(${orders.createdAt}, '${dateFormat}')`,
        total: orders.total,
        id: orders.id,
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'paid'),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, now)
        )
      )
      .as('sub')

    const salesData = await db
      .select({
        period: subquery.period,
        sales: sum(subquery.total),
        orders: count(subquery.id),
      })
      .from(subquery)
      .groupBy(subquery.period)
      .orderBy(subquery.period)

    const formattedData = salesData.map(row => ({
      period: formatPeriodLabel(row.period!, groupBy),
      sales: Number(row.sales || 0),
      orders: Number(row.orders || 0),
    }))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Error fetching sales report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatPeriodLabel(period: string, groupBy: string): string {
  switch (groupBy) {
    case 'day':
      return new Date(period).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit'
      })
    case 'week':
      const [year, week] = period.split('-')
      return `Sem ${week}/${year.slice(-2)}`
    case 'month':
      const [year2, month] = period.split('-')
      return new Date(parseInt(year2), parseInt(month) - 1).toLocaleDateString('es-ES', {
        month: 'short',
        year: '2-digit'
      })
    default:
      return period
  }
}
