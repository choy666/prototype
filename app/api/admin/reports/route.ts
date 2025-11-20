import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { orders, orderItems, products, users } from '@/lib/schema'
import { eq, sum, count, desc, gte, lte, and, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'sales'
    const period = searchParams.get('period') || 'month'

    let data

    switch (type) {
      case 'sales':
        data = await getSalesReport(period)
        break
      case 'products':
        data = await getProductsReport()
        break
      case 'users':
        data = await getUsersReport(period)
        break
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getSalesReport(period: string) {
  const now = new Date()
  let startDate: Date

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'quarter':
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      break
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  // Get sales data grouped by date
  const salesData = await db
    .select({
      date: sql<string>`DATE(${orders.createdAt})`,
      sales: sum(orders.total),
      orders: count(orders.id),
    })
    .from(orders)
    .where(
      and(
        sql`${orders.status} NOT IN ('cancelled', 'rejected')`,
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, now)
      )
    )
    .groupBy(sql`DATE(${orders.createdAt})`)
    .orderBy(sql`DATE(${orders.createdAt})`)

  return salesData.map(row => ({
    period: row.date,
    sales: Number(row.sales || 0),
    orders: Number(row.orders || 0),
  }))
}

async function getProductsReport() {
  // Get top selling products
  const productSales = await db
    .select({
      name: products.name,
      sold: sum(orderItems.quantity),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(
      and(
        sql`${orders.status} NOT IN ('cancelled', 'rejected')`
      )
    )
    .groupBy(products.id, products.name)
    .orderBy(desc(sum(orderItems.quantity)))
    .limit(10)

  return productSales.map(row => ({
    name: row.name,
    sold: Number(row.sold || 0),
  }))
}

async function getUsersReport(period: string) {
  const now = new Date()
  let startDate: Date

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'quarter':
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      break
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  // Get active users (users who made orders in the period)
  const activeUsers = await db
    .select({
      date: sql<string>`DATE(${orders.createdAt})`,
      activeUsers: count(sql`DISTINCT ${orders.userId}`),
    })
    .from(orders)
    .where(
      and(
        sql`${orders.status} NOT IN ('cancelled', 'rejected')`,
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, now)
      )
    )
    .groupBy(sql`DATE(${orders.createdAt})`)
    .orderBy(sql`DATE(${orders.createdAt})`)

  // Get new users
  const newUsers = await db
    .select({
      date: sql<string>`DATE(${users.createdAt})`,
      newUsers: count(users.id),
    })
    .from(users)
    .where(
      and(
        gte(users.createdAt, startDate),
        lte(users.createdAt, now)
      )
    )
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(sql`DATE(${users.createdAt})`)

  // Combine the data
  const combinedData: { [key: string]: { activeUsers: number; newUsers: number } } = {}

  activeUsers.forEach(row => {
    combinedData[row.date] = { activeUsers: Number(row.activeUsers), newUsers: 0 }
  })

  newUsers.forEach(row => {
    if (combinedData[row.date]) {
      combinedData[row.date].newUsers = Number(row.newUsers)
    } else {
      combinedData[row.date] = { activeUsers: 0, newUsers: Number(row.newUsers) }
    }
  })

  return Object.entries(combinedData).map(([date, data]) => ({
    period: date,
    activeUsers: data.activeUsers,
    newUsers: data.newUsers,
  }))
}
