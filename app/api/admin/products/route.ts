import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { getProducts, createProduct } from '@/lib/actions/products'
import { z } from 'zod'

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  image: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  category: z.string().min(1),
  categoryId: z.number().optional(),
  destacado: z.boolean().default(false),
  stock: z.number().int().min(0).default(0),
  discount: z.number().int().min(0).max(100).default(0),
  weight: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const category = searchParams.get('category') || undefined
    const search = searchParams.get('search') || undefined
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const result = await getProducts(page, limit, {
      category,
      search,
      sortBy: sortBy as 'created_at' | 'name' | 'price' | 'stock',
      sortOrder: sortOrder as 'asc' | 'desc',
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching products:', error)
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
    const validatedData = createProductSchema.parse(body)

    const product = await createProduct({
      ...validatedData,
      price: validatedData.price,
      weight: validatedData.weight ? validatedData.weight : null,
      images: validatedData.images || [],
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
