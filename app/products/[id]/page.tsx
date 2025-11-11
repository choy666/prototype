import { notFound } from 'next/navigation'
import { getProductById } from '@/lib/actions/products'
import { getProductVariants } from '@/lib/actions/productVariants'
import ProductClient from '@/app/products/[id]/ProductClient'
import { z } from 'zod'
import { ProductVariant } from '@/types/index'

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

    // Obtener variantes del producto
    const variants = await getProductVariants(productId)

    // Cast attributes to proper type
    const productWithAttributes = {
      ...product,
      attributes: product.attributes as Record<string, string> || undefined,
      variants: (variants as ProductVariant[]) || [],
      images: product.images as string[] || []
    }

    return <ProductClient product={productWithAttributes} />
  } catch (error) {
    console.error('Error loading product:', error)
    return notFound()
  }
}
