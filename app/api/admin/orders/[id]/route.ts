import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { orders, orderItems, products, users, productVariants } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'

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
        variantId: orderItems.variantId,
        productName: products.name,
        productImage: products.image,
        productAttributes: products.attributes,
        variantName: productVariants.name,
        variantImage: productVariants.images,
        variantAttributes: productVariants.additionalAttributes,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
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
        variantId: item.variantId,
        productName: item.productName || 'Producto desconocido',
        productImage: item.productImage,
        productAttributes: typeof item.productAttributes === 'object' && item.productAttributes !== null ? item.productAttributes : {},
        variantName: item.variantName || '',
        variantImage: Array.isArray(item.variantImage) ? item.variantImage : [],
        variantAttributes: typeof item.variantAttributes === 'object' && item.variantAttributes !== null ? item.variantAttributes : {},
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
      logger.warn('Unauthorized access attempt to update order', { userId: session?.user?.id, params: await params })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: orderId } = await params
    const orderIdNum = parseInt(orderId)
    if (isNaN(orderIdNum)) {
      logger.warn('Invalid order ID provided', { orderId, userId: session.user.id })
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    }

    const body = await request.json()
    const validatedData = updateOrderSchema.parse(body)

    logger.info('Order update initiated', {
      orderId: orderIdNum,
      userId: session.user.id,
      changes: validatedData
    })

    // Verificar que la orden existe
    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderIdNum))
      .limit(1)

    if (existingOrder.length === 0) {
      logger.warn('Order not found for update', { orderId: orderIdNum, userId: session.user.id })
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

    logger.info('Order updated successfully', {
      orderId: orderIdNum,
      userId: session.user.id,
      previousStatus: existingOrder[0].status,
      newStatus: updatedOrder.status,
      trackingNumber: updatedOrder.trackingNumber
    })

    return NextResponse.json({
      ...updatedOrder,
      total: Number(updatedOrder.total),
      shippingCost: Number(updatedOrder.shippingCost),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Validation error during order update', {
        orderId: await params.then(p => p.id),
        userId: (await auth())?.user?.id,
        issues: error.issues
      })
      return NextResponse.json({
        error: 'Error de validación',
        details: error.issues.map(issue => issue.message).join(', ')
      }, { status: 400 })
    }

    logger.error('Unexpected error during order update', {
      orderId: await params.then(p => p.id),
      userId: (await auth())?.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json({
      error: 'Error interno del servidor',
      details: 'Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.'
    }, { status: 500 })
  }
}
