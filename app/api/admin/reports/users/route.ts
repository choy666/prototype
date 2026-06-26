import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { orders, users } from '@/lib/schema'
import { count, gte, lte, and, sql } from 'drizzle-orm'

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
        dateFormat = 'IYYY-IW'
        break
      case 'month':
        dateFormat = 'YYYY-MM'
        break
      default:
        dateFormat = 'YYYY-MM-DD'
    }

    // Get active users (users who made orders in the period)
    const activeUsers = await db
      .select({
        period: sql<string>`to_char(${orders.createdAt}, ${dateFormat})`.as('period'),
        activeUsers: count(sql`DISTINCT ${orders.userId}`),
      })
      .from(orders)
      .where(
        and(
          sql`${orders.status} IN ('paid', 'shipped', 'delivered')`,
          sql`${orders.status} != 'cancelled'`,
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, now)
        )
      )
      .groupBy(sql`period`)
      .orderBy(sql`period`)

    // Reportes basados en pago, no en logística
    // Get new users
    const newUsers = await db
      .select({
        period: sql<string>`to_char(${users.createdAt}, ${dateFormat})`.as('period'),
        newUsers: count(users.id),
      })
      .from(users)
      .where(
        and(
          gte(users.createdAt, startDate),
          lte(users.createdAt, now)
        )
      )
      .groupBy(sql`period`)
      .orderBy(sql`period`)

    // Combine the data
    const combinedData: { [key: string]: { activeUsers: number; newUsers: number } } = {}

    activeUsers.forEach(row => {
      combinedData[row.period!] = { activeUsers: Number(row.activeUsers), newUsers: 0 }
    })

    newUsers.forEach(row => {
      if (combinedData[row.period!]) {
        combinedData[row.period!].newUsers = Number(row.newUsers)
      } else {
        combinedData[row.period!] = { activeUsers: 0, newUsers: Number(row.newUsers) }
      }
    })

    const formattedData = Object.entries(combinedData).map(([period, data]) => ({
      period: formatPeriodLabel(period, groupBy),
      activeUsers: data.activeUsers,
      newUsers: data.newUsers,
    }))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Error fetching users report:', error)
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
