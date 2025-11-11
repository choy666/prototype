import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { products, productVariants } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'

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

    // Actualizar atributos heredados en variantes existentes
    try {
      // Obtener todas las variantes del producto
      const existingVariants = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, productId))

      if (existingVariants.length > 0) {
        logger.info('Updating inherited attributes for variants', {
          productId,
          variantCount: existingVariants.length,
          userId: session.user.id
        })

        // Para cada variante, actualizar los atributos heredados
        // Mantener los atributos adicionales específicos de cada variante
        const updatePromises = existingVariants.map(variant => {
          // Los atributos heredados son los del padre, pero cada variante puede tener modificaciones específicas
          // Por simplicidad, actualizamos los atributos base heredados
          // En el futuro, podríamos implementar lógica más compleja para merges
          return db
            .update(productVariants)
            .set({
              attributes: body.attributes, // Actualizar atributos heredados
              updated_at: new Date()
            })
            .where(eq(productVariants.id, variant.id))
        })

        await Promise.all(updatePromises)

        logger.info('Successfully updated inherited attributes for all variants', {
          productId,
          variantsUpdated: existingVariants.length,
          userId: session.user.id
        })
      } else {
        logger.info('No variants found for product, skipping variant updates', {
          productId,
          userId: session.user.id
        })
      }
    } catch (variantUpdateError) {
      logger.error('Error updating inherited attributes in variants', {
        productId,
        error: variantUpdateError instanceof Error ? variantUpdateError.message : 'Unknown error',
        userId: session.user.id
      })
      // No fallar la operación completa por error en variantes, pero loggear
    }

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
