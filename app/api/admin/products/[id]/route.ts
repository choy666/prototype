import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { getProductById, updateProduct, deleteProduct } from '@/lib/actions/products'
import { z } from 'zod'

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  image: z.string().url().optional(),
  images: z.union([z.string(), z.array(z.string().url())]).optional().transform((val) => {
    if (typeof val === 'string') {
      return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }
    return val;
  }),
  category: z.string().min(1).optional(),
  categoryId: z.number().optional(),
  destacado: z.boolean().optional(),
  stock: z.number().int().min(0).optional(),
  discount: z.number().int().min(0).max(100).optional(),
  weight: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
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
    const idNum = parseInt(id)
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const product = await getProductById(idNum)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
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
    const idNum = parseInt(id)
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await request.json()
    const validatedData = updateProductSchema.parse(body)

    const product = await updateProduct(idNum, {
      ...validatedData,
      price: validatedData.price,
      weight: validatedData.weight,
      images: validatedData.images,
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error updating product:', error)
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
    const idNum = parseInt(id)
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const deleted = await deleteProduct(idNum)
    if (!deleted) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Error deleting product:', error)
    if (error instanceof Error && error.message.includes('órdenes asociadas')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
