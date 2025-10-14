import { notFound } from 'next/navigation'
import { getProductById } from '@/lib/actions/products'
import ProductClient from '@/app/products/[id]/ProductClient'
import { z } from 'zod'

// ✅ Esquema de validación para params
const paramsSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'El ID debe ser numérico')
    .transform((val) => parseInt(val, 10)),
})

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  try {
    // 🔎 Resolver params primero
    const rawParams = await params

    // 🔎 Validar con Zod
    const parsed = paramsSchema.safeParse(rawParams)
    if (!parsed.success) {
      return notFound()
    }

    const productId = parsed.data.id

    const product = await getProductById(productId)

    if (!product) {
      return notFound()
    }

    return <ProductClient product={product} />
  } catch (error) {
    console.error('Error loading product:', error)
    return notFound()
  }
}