import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { createProductVariant, getProductVariants } from '@/lib/actions/productVariants'
import { z } from 'zod'

const createVariantSchema = z.object({
  attributes: z.record(z.string(), z.string()), // { "Talla": "M", "Color": "Rojo" }
  stock: z.number().min(0).default(0),
  price: z.string().optional(), // precio específico opcional
  sku: z.string().optional(),
  image: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const productId = parseInt(id)
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
    }

    const variants = await getProductVariants(productId)
    return NextResponse.json(variants)
  } catch (error) {
    console.error('Error fetching product variants:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const productId = parseInt(id)
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
    }

    const body = await request.json()
    const validatedData = createVariantSchema.parse(body)

    // Mantener price como string para coincidir con el schema
    const variantData = {
      productId,
      attributes: validatedData.attributes,
      stock: validatedData.stock,
      price: validatedData.price,
      sku: validatedData.sku,
      image: validatedData.image,
    }

    const variant = await createProductVariant(variantData)
    return NextResponse.json(variant, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error creating product variant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
