import { NextResponse } from 'next/server'
import { MERCADOLIBRE_CONFIG } from '@/lib/auth/mercadolibre'
import { logger } from '@/lib/utils/logger'

// Endpoint de solo lectura que devuelve atributos recomendados/obligatorios
// para una categoría de Mercado Libre, ya mapeados al formato usado por
// AttributeBuilder (key, label, aliases, required).

type RecommendedAttributeConfig = {
  key: string
  label: string
  aliases: string[]
  required?: boolean
}

interface MercadoLibreCategoryAttribute {
  id: string
  name: string
  tags?: {
    required?: boolean
    catalog_required?: boolean
    allow_variations?: boolean
    [key: string]: unknown
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mlCategoryId: string }> }
) {
  const { mlCategoryId } = await params

  if (!mlCategoryId) {
    return NextResponse.json(
      { error: 'mlCategoryId es requerido' },
      { status: 400 }
    )
  }

  try {
    const response = await fetch(
      `${MERCADOLIBRE_CONFIG.apiUrl}/categories/${mlCategoryId}/attributes`
    )

    if (!response.ok) {
      logger.warn('Error obteniendo atributos de categoría ML', {
        mlCategoryId,
        status: response.status,
      })

      return NextResponse.json(
        { error: 'No se pudieron obtener los atributos de la categoría' },
        { status: 502 }
      )
    }

    const data = (await response.json()) as MercadoLibreCategoryAttribute[]

    const rawAttributes = Array.isArray(data) ? data : []

    // Seleccionar atributos marcados como requeridos o relevantes
    const mapped: RecommendedAttributeConfig[] = rawAttributes
      .map((attr) => {
        const tags: MercadoLibreCategoryAttribute['tags'] = attr.tags ?? {}
        const isRequired = Boolean(tags.required) || Boolean(tags.catalog_required)
        const isRecommended = isRequired || Boolean(tags.allow_variations)

        if (!isRequired && !isRecommended) {
          return null
        }

        const name = attr.name?.trim() || attr.id

        return {
          key: attr.id,
          label: `${name} (${attr.id})`,
          aliases: [name, attr.id],
          required: isRequired || undefined,
        }
      })
      .filter(Boolean) as RecommendedAttributeConfig[]

    // Fallback: si nada viene marcado como requerido/relevante, devolver un subset limitado
    const attributes: RecommendedAttributeConfig[] =
      mapped.length > 0
        ? mapped
        : rawAttributes.slice(0, 15).map((attr) => {
            const name = attr.name?.trim() || attr.id
            return {
              key: attr.id,
              label: `${name} (${attr.id})`,
              aliases: [name, attr.id],
            }
          })

    return NextResponse.json({ attributes })
  } catch (error) {
    logger.error('Error interno obteniendo atributos de categoría ML', {
      mlCategoryId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
