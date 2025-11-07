import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { products } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'

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
      logger.warn('Unauthorized access to product details', {
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
      logger.warn('Invalid product ID format', {
        productId: id,
        userId: session.user.id,
        path: request.nextUrl.pathname
      })
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 })
    }

    const [product] = await db.select().from(products).where(eq(products.id, productId))
    if (!product) {
      logger.info('Product not found', {
        productId,
        userId: session.user.id,
        path: request.nextUrl.pathname
      })
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    logger.info('Product details fetched successfully', {
      productId,
      productName: product.name,
      stock: product.stock,
      userId: session.user.id,
      path: request.nextUrl.pathname
    })

    return NextResponse.json(product)
  } catch (error) {
    logger.error('Error fetching product details', {
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
