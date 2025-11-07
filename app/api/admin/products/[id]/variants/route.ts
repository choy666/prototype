import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { createProductVariant, getProductVariants, updateProductVariant } from '@/lib/actions/productVariants'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'

const createVariantSchema = z.object({
  attributes: z.record(z.string(), z.string()), // { "Talla": "M", "Color": "Rojo" }
  stock: z.number().min(0).default(0),
  price: z.string().optional(), // precio específico opcional
  images: z.array(z.string()).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const productId = parseInt(id)

  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      logger.warn('Unauthorized access to product variants', {
        userId: session?.user.id,
        userRole: session?.user?.role,
        path: request.nextUrl.pathname,
        productId,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      })
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (isNaN(productId)) {
      logger.warn('Invalid product ID format for variants', {
        productId: id,
        userId: session.user.id,
        path: request.nextUrl.pathname
      })
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 })
    }

    const variants = await getProductVariants(productId)

    logger.info('Product variants fetched successfully', {
      productId,
      variantCount: variants.length,
      userId: session.user.id,
      path: request.nextUrl.pathname
    })

    return NextResponse.json(variants)
  } catch (error) {
    logger.error('Error fetching product variants', {
      productId,
      userId: (await auth())?.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: request.nextUrl.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent')
    })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const productId = parseInt(id)

  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      logger.warn('Unauthorized attempt to create product variant', {
        userId: session?.user.id,
        userRole: session?.user?.role,
        path: request.nextUrl.pathname,
        productId,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      })
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (isNaN(productId)) {
      logger.warn('Invalid product ID format for variant creation', {
        productId: id,
        userId: session.user.id,
        path: request.nextUrl.pathname
      })
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 })
    }

    const body = await request.json()
    const validatedData = createVariantSchema.parse(body)

    // Mantener price como string para coincidir con el schema
    const variantData = {
      productId,
      attributes: validatedData.attributes,
      stock: validatedData.stock,
      price: validatedData.price,
      images: validatedData.images,
    }

    const variant = await createProductVariant(variantData)

    logger.info('Product variant created successfully', {
      productId,
      variantId: variant.id,
      attributes: validatedData.attributes,
      stock: validatedData.stock,
      userId: session.user.id,
      path: request.nextUrl.pathname
    })

    return NextResponse.json(variant, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation error creating product variant', {
        productId,
        userId: (await auth())?.user?.id,
        validationErrors: error.issues,
        path: request.nextUrl.pathname
      })
      return NextResponse.json({ error: 'Error de validación', issues: error.issues }, { status: 400 })
    }
    logger.error('Error creating product variant', {
      productId,
      userId: (await auth())?.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: request.nextUrl.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent')
    })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
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

    if (!variantId) {
      return NextResponse.json({ error: 'variantId is required' }, { status: 400 })
    }

    const updatedVariant = await updateProductVariant(variantId, updateData)
    if (!updatedVariant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    return NextResponse.json(updatedVariant)
  } catch (error) {
    console.error('Error updating product variant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
