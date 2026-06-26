import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { products } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'

// GET: Obtener atributos actuales del producto
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const id = resolvedParams.id
  const productId = parseInt(id)

  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (isNaN(productId)) {
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 })
    }

    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: {
        id: true,
        name: true,
        mlCategoryId: true,
        attributes: true,
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      id: product.id,
      name: product.name,
      mlCategoryId: product.mlCategoryId,
      attributes: product.attributes || {},
    })
  } catch (error) {
    logger.error('Error getting product attributes', {
      productId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PUT: Actualizar atributos del producto
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const id = resolvedParams.id
  const productId = parseInt(id)

  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      logger.warn('Unauthorized access to update product attributes', {
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
      logger.warn('Invalid product ID format for attributes update', {
        productId: id,
        userId: session.user.id,
        path: request.nextUrl.pathname
      })
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 })
    }

    const body = await request.json()
    logger.info('Received attributes update request body', {
      productId,
      bodyKeys: Object.keys(body),
      userId: session.user.id
    })

    // Validar que el body tenga attributes
    if (!body || typeof body !== 'object' || !('attributes' in body)) {
      logger.warn('Invalid request body for attributes update', {
        productId,
        body,
        userId: session.user.id
      })
      return NextResponse.json({ error: 'Cuerpo de la solicitud inválido: se requieren atributos' }, { status: 400 })
    }

    const updateData = {
      attributes: body.attributes,
      updated_at: new Date()
    }

    logger.info('Prepared attributes update data', {
      productId,
      hasAttributes: !!updateData.attributes,
      userId: session.user.id
    })

    const [updatedProduct] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, productId))
      .returning()

    if (!updatedProduct) {
      logger.warn('Product not found for attributes update', {
        productId,
        userId: session.user.id
      })
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    // NOTA: No actualizar atributos de variantes existentes al cambiar atributos del padre
    // Las variantes deben mantener sus atributos específicos (Record<string, string>)
    // independientemente de los cambios en los atributos dinámicos del producto padre
    logger.info('Skipping variant attributes update - variants maintain their specific attributes', {
      productId,
      userId: session.user.id
    })

    logger.info('Product attributes updated successfully', {
      productId,
      productName: updatedProduct.name,
      userId: session.user.id,
      path: request.nextUrl.pathname
    })

    return NextResponse.json(updatedProduct)
  } catch (error) {
    logger.error('Error updating product attributes', {
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
