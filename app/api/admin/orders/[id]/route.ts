import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { orders, orderItems, products, users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const updateOrderSchema = z.object({
  status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'rejected']).optional(),
  trackingNumber: z.string().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: orderId } = await params
    const orderIdNum = parseInt(orderId)
    if (isNaN(orderIdNum)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    }

    // Obtener orden con información del usuario
    const orderData = await db
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
      .where(eq(orders.id, orderIdNum))
      .limit(1)

    if (orderData.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Obtener items de la orden
    const items = await db
      .select({
        id: orderItems.id,
        quantity: orderItems.quantity,
        price: orderItems.price,
        productId: orderItems.productId,
        productName: products.name,
        productImage: products.image,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderIdNum))

    const order = orderData[0]
    const orderWithItems = {
      ...order,
      total: Number(order.total),
      shippingCost: Number(order.shippingCost),
      items: items.map(item => ({
        id: item.id.toString(),
        quantity: item.quantity,
        price: Number(item.price),
        productId: item.productId,
        productName: item.productName || 'Producto desconocido',
        productImage: item.productImage,
      })),
    }

    return NextResponse.json(orderWithItems)
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: orderId } = await params
    const orderIdNum = parseInt(orderId)
    if (isNaN(orderIdNum)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    }

    const body = await request.json()
    const validatedData = updateOrderSchema.parse(body)

    // Verificar que la orden existe
    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderIdNum))
      .limit(1)

    if (existingOrder.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Actualizar la orden
    const [updatedOrder] = await db
      .update(orders)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderIdNum))
      .returning()

    return NextResponse.json({
      ...updatedOrder,
      total: Number(updatedOrder.total),
      shippingCost: Number(updatedOrder.shippingCost),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
