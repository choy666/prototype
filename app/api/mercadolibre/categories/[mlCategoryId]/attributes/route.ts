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
      `${MERCADOLIBRE_CONFIG.baseUrl}/categories/${mlCategoryId}/attributes`
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

    // Seleccionar atributos marcados como requeridos, condicionalmente requeridos o relevantes
    const mappedAttributes: RecommendedAttributeConfig[] = rawAttributes
      .map((attr) => {
        const tags: MercadoLibreCategoryAttribute['tags'] = attr.tags ?? {}
        const isRequired = Boolean(tags.required) || Boolean(tags.catalog_required)
        const isConditional = Boolean(tags.conditional_required)
        const isRecommended = isRequired || isConditional || Boolean(tags.allow_variations)

        if (!isRequired && !isConditional && !isRecommended) {
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
    const fallbackAttributes = mappedAttributes.length > 0
      ? mappedAttributes
      : rawAttributes.slice(0, 15).map((attr) => {
          const name = attr.name?.trim() || attr.id
          return {
            key: attr.id,
            label: `${name} (${attr.id})`,
            aliases: [name, attr.id],
          }
        })

    // Procesar atributos para el frontend
    const allAttributes = rawAttributes
    const requiredAttributes = allAttributes.filter(attr => 
      attr.tags?.required === true || attr.tags?.catalog_required === true
    )
    const recommendedAttributes = allAttributes.filter(attr => 
      (attr.tags?.allow_variations === true) && !requiredAttributes.includes(attr)
    )
    const conditionalAttributes = allAttributes.filter(attr => 
      attr.tags?.conditional_required === true && !requiredAttributes.includes(attr)
    )
    const optionalAttributes = allAttributes.filter(attr => 
      !requiredAttributes.includes(attr) && 
      !recommendedAttributes.includes(attr) && 
      !conditionalAttributes.includes(attr)
    )

    // Buscar atributos EMPTY_*_REASON para obtener valores válidos
    const emptyReasonAttributes = allAttributes.filter(attr => 
      attr.id.startsWith('EMPTY_') && attr.id.endsWith('_REASON')
    )

    // Crear objeto con la estructura esperada por el frontend
    const processedData = {
      category: {
        id: 0, // Placeholder, el frontend no lo usa
        name: `Categoría ${mlCategoryId}`,
        mlCategoryId: mlCategoryId
      },
      // Estructura para MLAttributesGuide
      mlAttributes: {
        all: allAttributes,
        required: requiredAttributes,
        recommended: recommendedAttributes,
        conditional: conditionalAttributes,
        optional: optionalAttributes,
        emptyReasons: emptyReasonAttributes
      },
      summary: {
        total: allAttributes.length,
        required: requiredAttributes.length,
        recommended: recommendedAttributes.length,
        conditional: conditionalAttributes.length,
        optional: optionalAttributes.length
      },
      // Mantener compatibilidad con el formato anterior para new/page.tsx
      attributes: fallbackAttributes,
      rawAttributes: rawAttributes
    }

    return NextResponse.json(processedData)
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
