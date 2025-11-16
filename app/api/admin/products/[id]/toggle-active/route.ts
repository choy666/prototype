import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { updateProduct } from '@/lib/actions/products'
import { z } from 'zod'

const toggleActiveSchema = z.object({
  isActive: z.boolean(),
})

export async function PATCH(
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
    const validatedData = toggleActiveSchema.parse(body)

    const updatedProduct = await updateProduct(productId, {
      isActive: validatedData.isActive,
    })

    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(updatedProduct)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error toggling product active status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
