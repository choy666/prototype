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

// ✅ Tipo inferido de la tabla products
type ProductRow = typeof products.$inferSelect

// ✅ Tipo para items ya procesados
interface ComputedItem extends CheckoutItem {
  name: string
  unitPrice: number
  discount?: number // 👈 compatible con CheckoutItem
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

    // ✅ Validar shippingAddress con Zod
    const parsedShipping = ShippingFormSchema.safeParse(shippingAddress)
    if (!parsedShipping.success) {
      return NextResponse.json(
        { error: 'Dirección de envío inválida', details: parsedShipping.error.flatten() },
        { status: 400 }
      )
    }

    // --- Recalcular precios desde DB ---
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
        discount: p.discount ?? undefined, // 👈 normalizamos null → undefined
      })
      return {
        ...item,
        name: p.name,
        unitPrice: finalUnitPrice,
        discount: p.discount ?? undefined,
      }
    })

    const serverTotal = computedItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)

    // --- Crear orden en DB ---
    const { orderId } = await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values({
        userId: parseInt(session.user.id),
        total: serverTotal.toFixed(2), // 👈 decimal espera string
        status: 'pending',
        shippingAddress: parsedShipping.data,
      }).returning()

      await Promise.all(
        computedItems.map(ci =>
          tx.insert(orderItems).values({
            orderId: order.id,
            productId: ci.id,
            quantity: ci.quantity,
            price: ci.unitPrice.toFixed(2), // 👈 decimal espera string
          })
        )
      )

      return { orderId: order.id }
    })

    // --- Crear preferencia con helper ---
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