import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { products, categories } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre'
import { logger } from '@/lib/utils/logger'

export async function POST(
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

    // Obtener el producto con su categoría
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: {
        id: true,
        name: true,
        mlCategoryId: true,
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    if (!product.mlCategoryId) {
      return NextResponse.json({ error: 'El producto no tiene categoría de Mercado Libre' }, { status: 400 })
    }

    // Obtener token de ML
    const mlAuth = await MercadoLibreAuth.getInstance()
    const accessToken = await mlAuth.getAccessToken()

    if (!accessToken) {
      return NextResponse.json({ error: 'No se pudo obtener el token de Mercado Libre' }, { status: 500 })
    }

    // Obtener atributos de la categoría desde ML
    const attributesUrl = `https://api.mercadolibre.com/categories/${product.mlCategoryId}/attributes`
    const response = await fetch(attributesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      logger.error('[Sync Attributes] Error obteniendo atributos de ML', {
        categoryId: product.mlCategoryId,
        status: response.status
      })
      return NextResponse.json({ 
        error: `Error al obtener atributos de ML: ${response.status}` 
      }, { status: 500 })
    }

    const attributesData = await response.json()
    const attributes = Array.isArray(attributesData) 
      ? attributesData.map((attr: { id: string; tags?: string[]; value_type?: string; values?: Array<{ name: string }> }) => ({
          id: attr.id,
          tags: attr.tags || [],
          valueType: attr.value_type,
          values: attr.values || []
        }))
      : []

    // Actualizar la categoría con los atributos
    const updatedCategory = await db
      .update(categories)
      .set({
        attributes,
        updated_at: new Date()
      })
      .where(eq(categories.mlCategoryId, product.mlCategoryId))
      .returning()

    if (updatedCategory.length === 0) {
      logger.warn('[Sync Attributes] Categoría no encontrada en BD', {
        categoryId: product.mlCategoryId
      })
      return NextResponse.json({ error: 'Categoría no encontrada en la base de datos' }, { status: 404 })
    }

    logger.info('[Sync Attributes] Atributos sincronizados exitosamente', {
      productId,
      categoryId: product.mlCategoryId,
      attributesCount: attributes.length
    })

    return NextResponse.json({
      success: true,
      message: `Se sincronizaron ${attributes.length} atributos para la categoría`,
      categoryId: product.mlCategoryId,
      attributesCount: attributes.length,
      attributes: attributes
    })

  } catch (error) {
    logger.error('[Sync Attributes] Error sincronizando atributos', {
      productId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}
