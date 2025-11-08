import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { products } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'

import { deleteProduct } from '@/lib/actions/products'

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
      logger.warn('Unauthorized access to update product', {
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
      logger.warn('Invalid product ID format for update', {
        productId: id,
        userId: session.user.id,
        path: request.nextUrl.pathname
      })
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 })
    }

    const body = await request.json()
    logger.info('Received update request body', {
      productId,
      bodyKeys: Object.keys(body),
      userId: session.user.id
    })

    // Validar que el body no esté vacío
    if (!body || typeof body !== 'object') {
      logger.warn('Invalid request body for product update', {
        productId,
        body,
        userId: session.user.id
      })
      return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 })
    }

    const updateData = {
      name: body.name,
      description: body.description,
      price: body.price,
      image: body.image,
      images: body.images,
      categoryId: body.categoryId,
      discount: body.discount,
      weight: body.weight,
      stock: body.stock,
      destacado: body.destacado,
      attributes: body.attributes,
      updated_at: new Date()
    }

    logger.info('Prepared update data', {
      productId,
      updateDataKeys: Object.keys(updateData),
      hasAttributes: !!updateData.attributes,
      userId: session.user.id
    })

    const [updatedProduct] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, productId))
      .returning()

    if (!updatedProduct) {
      logger.warn('Product not found for update', {
        productId,
        userId: session.user.id
      })
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    logger.info('Product updated successfully', {
      productId,
      productName: updatedProduct.name,
      userId: session.user.id,
      path: request.nextUrl.pathname
    })

    return NextResponse.json(updatedProduct)
  } catch (error) {
    logger.error('Error updating product', {
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const id = resolvedParams.id
  const productId = parseInt(id)

  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      logger.warn('Unauthorized access to delete product', {
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
      logger.warn('Invalid product ID format for deletion', {
        productId: id,
        userId: session.user.id,
        path: request.nextUrl.pathname
      })
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 })
    }

    await deleteProduct(productId)

    logger.info('Product deleted successfully', {
      productId,
      userId: session.user.id,
      path: request.nextUrl.pathname
    })

    return NextResponse.json({ message: 'Producto eliminado correctamente' })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    logger.error('Error deleting product', {
      productId,
      userId: (await auth())?.user?.id,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      path: request.nextUrl.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent')
    })
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
