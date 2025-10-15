// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { orders, orderItems, products } from '@/lib/schema'
import { eq, inArray } from 'drizzle-orm'
import { CheckoutItem } from '@/types/index'
import { getDiscountedPrice } from '@/lib/utils/pricing'
import { createPreference } from '@/lib/mercadopago/mercadopago'
import { ShippingFormSchema } from '@/lib/mercadopago/validationsMP'

type ProductRow = typeof products.$inferSelect

interface ComputedItem extends CheckoutItem {
  name: string
  unitPrice: number
  discount?: number
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as {
      items: CheckoutItem[]
      shippingAddress: unknown
      total?: number | string
    }

    const { items, shippingAddress } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Carrito vacío' }, { status: 400 })
    }

    const parsedShipping = ShippingFormSchema.safeParse(shippingAddress)
    if (!parsedShipping.success) {
      return NextResponse.json(
        { error: 'Dirección de envío inválida', details: parsedShipping.error.flatten() },
        { status: 400 }
      )
    }

    const productIds = items.map(i => i.id)
    const dbProducts: ProductRow[] = await db
      .select()
      .from(products)
      .where(inArray(products.id, productIds))

    const byId = new Map<number, ProductRow>()
    for (const p of dbProducts) byId.set(p.id as number, p)

    for (const item of items) {
      if (!byId.has(item.id)) {
        return NextResponse.json({ error: `Producto ${item.id} no encontrado` }, { status: 400 })
      }
    }

    const computedItems: ComputedItem[] = items.map(item => {
      const p = byId.get(item.id)!
      const finalUnitPrice = getDiscountedPrice({
        price: p.price,
        discount: p.discount ?? undefined,
      })
      return {
        ...item,
        name: p.name,
        unitPrice: finalUnitPrice,
        discount: p.discount ?? undefined,
      }
    })

    const serverTotal = computedItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)

    // Crear orden sin transacción (Neon HTTP no soporta transacciones)
    const [order] = await db.insert(orders).values({
      userId: parseInt(session.user.id),
      total: serverTotal.toFixed(2),
      status: 'pending',
      shippingAddress: parsedShipping.data,
    }).returning()

    const orderId = order.id

    // Insertar items de la orden
    await Promise.all(
      computedItems.map(ci =>
        db.insert(orderItems).values({
          orderId: orderId,
          productId: ci.id,
          quantity: ci.quantity,
          price: ci.unitPrice.toFixed(2),
        })
      )
    )

    const { preferenceId, mpId } = await createPreference({
      items: computedItems.map(ci => ({
        id: ci.id.toString(),
        title: ci.name,
        quantity: ci.quantity,
        unit_price: Number(ci.unitPrice),
      })),
      payer: {
        name: parsedShipping.data.firstName,
        surname: parsedShipping.data.lastName,
        email: parsedShipping.data.email,
      },
      back_urls: {
        success: `${process.env.NEXTAUTH_URL}/checkout/success?order_id=${orderId}`,
        failure: `${process.env.NEXTAUTH_URL}/checkout/failure`,
        pending: `${process.env.NEXTAUTH_URL}/checkout/pending`,
      },
      auto_return: 'approved',
      external_reference: orderId.toString(),
    })

    if (mpId) {
      await db.update(orders)
        .set({ mercadoPagoId: mpId })
        .where(eq(orders.id, orderId))
    }

    return NextResponse.json({ preferenceId, orderId })
  } catch (error) {
    console.error('Error en checkout:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
