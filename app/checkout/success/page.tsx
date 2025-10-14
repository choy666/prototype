import { db } from '@/lib/db'
import { orders, orderItems, products } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils/format'
import { z } from 'zod'

// ✅ Esquema de validación con Zod (string numérico → number)
const searchParamsSchema = z.object({
  order_id: z
    .string()
    .regex(/^\d+$/, 'El ID de orden debe ser numérico')
    .transform((val) => parseInt(val, 10))
    .optional(),
})

// 🔹 Componente reutilizable para "Orden no encontrada"
function OrderNotFound() {
  return (
    <div className="container mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Orden no encontrada</h1>
      <Link href="/products">
        <Button>Volver a la tienda</Button>
      </Link>
    </div>
  )
}

// ✅ Server Component con props promesificados (Next 15 build)
//    Alineado con el checker de .next/types: searchParams es Promise
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // 🔎 Resolver los searchParams antes de validar
  const sp = await searchParams

  // 🔎 Validamos con Zod
  const parsed = searchParamsSchema.safeParse(sp)

  if (!parsed.success || !parsed.data.order_id) {
    return <OrderNotFound />
  }

  const orderId = parsed.data.order_id

  // 🔎 Consultamos la orden
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))

  if (!order) {
    return <OrderNotFound />
  }

  // 🔎 Consultamos los items de la orden
  const items = await db
    .select({
      id: orderItems.id,
      quantity: orderItems.quantity,
      price: orderItems.price,
      name: products.name,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId))

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">¡Gracias por tu compra!</h1>

      <div className="mb-6">
        <p>
          <strong>Número de orden:</strong> {order.id}
        </p>
        <p>
          <strong>Estado:</strong> {order.status}
        </p>
        <p>
          <strong>Total:</strong> {formatCurrency(Number(order.total))}
        </p>
      </div>

      <h2 className="text-xl font-semibold mb-4">Resumen de productos</h2>
      <div className="space-y-2 mb-6">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between">
            <span>
              {item.name} x{item.quantity}
            </span>
            <span>
              {formatCurrency(Number(item.price) * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      <Link href="/products">
        <Button>Seguir comprando</Button>
      </Link>
    </div>
  )
}