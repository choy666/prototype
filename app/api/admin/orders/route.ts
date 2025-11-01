import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { orders, orderItems, products, users } from '@/lib/schema'
import { eq, desc, and, gte, lte, like, sql } from 'drizzle-orm'
import { z } from 'zod'

const getOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'rejected']).optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  totalMin: z.coerce.number().min(0).optional(),
  totalMax: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['createdAt', 'total', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const params = {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '10',
      status: searchParams.get('status') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      totalMin: searchParams.get('totalMin') ? parseFloat(searchParams.get('totalMin')!) : undefined,
      totalMax: searchParams.get('totalMax') ? parseFloat(searchParams.get('totalMax')!) : undefined,
      sortBy: searchParams.get('sortBy') ?? 'createdAt',
      sortOrder: searchParams.get('sortOrder') ?? 'desc',
    }

    const validatedParams = getOrdersSchema.parse(params)
    const { page, limit, status, search, dateFrom, dateTo, totalMin, totalMax, sortBy, sortOrder } = validatedParams
    const offset = (page - 1) * limit

    // Construir condiciones de filtro
    const conditions = []
    if (status) {
      conditions.push(eq(orders.status, status))
    }
    if (search) {
      conditions.push(like(users.email, `%${search}%`))
    }
    if (dateFrom) {
      conditions.push(gte(orders.createdAt, new Date(dateFrom)))
    }
    if (dateTo) {
      conditions.push(lte(orders.createdAt, new Date(dateTo)))
    }
    if (typeof totalMin === 'number') {
      conditions.push(gte(orders.total, totalMin.toString()))
    }
    if (typeof totalMax === 'number') {
      conditions.push(lte(orders.total, totalMax.toString()))
    }

    // Obtener órdenes con información del usuario
    const ordersQuery = db
      .select({
        id: orders.id,
        userId: orders.userId,
        total: orders.total,
        status: orders.status,
        paymentId: orders.paymentId,
        mercadoPagoId: orders.mercadoPagoId,
        shippingAddress: orders.shippingAddress,
        shippingMethodId: orders.shippingMethodId,
        shippingCost: orders.shippingCost,
        trackingNumber: orders.trackingNumber,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        userEmail: users.email,
        userName: users.name,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sortOrder === 'desc' ? desc(orders[sortBy]) : sql`${orders[sortBy]} asc`)
      .limit(limit)
      .offset(offset)

    // Obtener conteo total
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    const [ordersData, countResult] = await Promise.all([ordersQuery, countQuery])
    const total = Number(countResult[0]?.count ?? 0)

    // Obtener items para cada orden
    const ordersWithItems = await Promise.all(
      ordersData.map(async (order) => {
        const items = await db
          .select({
            id: orderItems.id,
            quantity: orderItems.quantity,
            price: orderItems.price,
            productId: orderItems.productId,
            productName: products.name,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .where(eq(orderItems.orderId, order.id))

        return {
          ...order,
          total: Number(order.total),
          shippingCost: Number(order.shippingCost),
          items,
          itemCount: items.length,
        }
      })
    )

    return NextResponse.json({
      data: ordersWithItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
