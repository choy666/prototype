import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { createProductAttribute, getProductAttributes, updateProductAttribute, deleteProductAttribute } from '@/lib/actions/productVariants'
import { z } from 'zod'

const createAttributeSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  values: z.array(z.string().min(1)).min(1, 'Debe tener al menos un valor'),
})

const updateAttributeSchema = z.object({
  name: z.string().min(1).optional(),
  values: z.array(z.string().min(1)).min(1).optional(),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const attributes = await getProductAttributes()
    return NextResponse.json(attributes)
  } catch (error) {
    console.error('Error fetching product attributes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createAttributeSchema.parse(body)

    const attribute = await createProductAttribute(validatedData)
    return NextResponse.json(attribute, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error creating product attribute:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const validatedData = updateAttributeSchema.parse(updateData)
    const attribute = await updateProductAttribute(id, validatedData)

    if (!attribute) {
      return NextResponse.json({ error: 'Attribute not found' }, { status: 404 })
    }

    return NextResponse.json(attribute)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error updating product attribute:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const deleted = await deleteProductAttribute(parseInt(id))
    if (!deleted) {
      return NextResponse.json({ error: 'Attribute not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Attribute deleted successfully' })
  } catch (error) {
    console.error('Error deleting product attribute:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
