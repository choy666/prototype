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
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      logger.warn('Unauthorized access to product details', { userId: session?.user.id, path: request.nextUrl.pathname })
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const resolvedParams = await params
    const id = resolvedParams.id
    const productId = parseInt(id)
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 })
    }

    const [product] = await db.select().from(products).where(eq(products.id, productId))
    if (!product) {
      logger.info('Product not found', { productId })
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    logger.error('Error fetching product', {
      productId: (await params).id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
