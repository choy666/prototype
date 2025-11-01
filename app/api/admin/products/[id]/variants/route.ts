import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { createProductVariant, getProductVariants, updateProductVariant, deleteProductVariant } from '@/lib/actions/productVariants'
import { z } from 'zod'

const createVariantSchema = z.object({
  sku: z.string().optional(),
  attributes: z.record(z.string(), z.string()), // ej: { "Talla": "M", "Color": "Rojo" }
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  stock: z.number().int().min(0).default(0),
  image: z.string().url().optional(),
  isActive: z.boolean().default(true),
})

const updateVariantSchema = z.object({
  sku: z.string().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  stock: z.number().int().min(0).optional(),
  image: z.string().url().optional(),
  isActive: z.boolean().optional(),
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

    const variant = await createProductVariant({
      ...validatedData,
      productId,
      price: validatedData.price ? validatedData.price : null,
    })

    return NextResponse.json(variant, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error creating product variant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
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
    const { variantId, ...updateData } = body

    if (!variantId || typeof variantId !== 'number') {
      return NextResponse.json({ error: 'Variant ID is required' }, { status: 400 })
    }

    const validatedData = updateVariantSchema.parse(updateData)
    const variant = await updateProductVariant(variantId, {
      ...validatedData,
      price: validatedData.price ? validatedData.price : null,
    })

    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    return NextResponse.json(variant)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error updating product variant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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

    const { searchParams } = new URL(request.url)
    const variantId = searchParams.get('variantId')

    if (!variantId || isNaN(parseInt(variantId))) {
      return NextResponse.json({ error: 'Invalid variant ID' }, { status: 400 })
    }

    const deleted = await deleteProductVariant(parseInt(variantId))
    if (!deleted) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Variant deleted successfully' })
  } catch (error) {
    console.error('Error deleting product variant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
