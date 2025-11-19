import { NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { orderItems, orders, products } from '@/lib/schema'
import { eq, sum, desc } from 'drizzle-orm'

export async function GET() {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get top selling products
    const productSales = await db
      .select({
        id: products.id,
        name: products.name,
        sold: sum(orderItems.quantity),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orders.paymentStatus, 'paid'))
      .groupBy(products.id, products.name)
      .orderBy(desc(sum(orderItems.quantity)))
      .limit(10)

    const formattedData = productSales.map(row => ({
      name: row.name,
      sold: Number(row.sold || 0),
    }))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Error fetching products report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
