import { NextRequest, NextResponse } from 'next/server'
import { getProductById } from '@/lib/actions/products'
import { getProductVariants } from '@/lib/actions/productVariants'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'El ID debe ser numérico')
    .transform((val) => parseInt(val, 10)),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rawParams = await params
    const parsed = paramsSchema.safeParse(rawParams)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const productId = parsed.data.id

    const product = await getProductById(productId)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Obtener variantes del producto
    const variants = await getProductVariants(productId)

    // Retornar producto con variantes
    return NextResponse.json({
      ...product,
      variants,
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
