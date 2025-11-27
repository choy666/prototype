import { NextResponse } from 'next/server'
import { MERCADOLIBRE_CONFIG, MercadoLibreAuth } from '@/lib/auth/mercadolibre'
import { logger } from '@/lib/utils/logger'

interface ListingTypeConfig {
  id: string
  name: string
  saleFeePercent: number
  currency: string
}

interface MercadoLibreListingTypeResponse {
  id: string
  configuration?: {
    name?: string
    sale_fee_criteria?: {
      min_fee_amount?: number
      max_fee_amount?: number
      percentage_of_fee_amount?: number
      currency?: string
    }
  }
}

const DEFAULT_SITE_ID = process.env.MERCADOLIBRE_SITE_ID || 'MLA'

async function fetchListingTypeConfig(listingTypeId: string): Promise<ListingTypeConfig | null> {
  try {
    const url = `${MERCADOLIBRE_CONFIG.apiUrl}/sites/${DEFAULT_SITE_ID}/listing_types/${listingTypeId}`
    const auth = await MercadoLibreAuth.getInstance()
    const accessToken = await auth.getAccessToken()

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      logger.warn('Error obteniendo listing_type desde ML', {
        listingTypeId,
        status: response.status,
      })
      return null
    }

    const data = (await response.json()) as MercadoLibreListingTypeResponse

    const name = data.configuration?.name || listingTypeId
    const saleFeePercent =
      data.configuration?.sale_fee_criteria?.percentage_of_fee_amount ?? 0
    const currency = data.configuration?.sale_fee_criteria?.currency || 'ARS'

    return {
      id: listingTypeId,
      name,
      saleFeePercent,
      currency,
    }
  } catch (error) {
    logger.error('Error interno obteniendo listing_type desde ML', {
      listingTypeId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return null
  }
}

export async function GET() {
  try {
    const listingTypes = ['free', 'gold_special'] as const

    const results = await Promise.all(
      listingTypes.map((id) => fetchListingTypeConfig(id))
    )

    const configs = results.filter(Boolean) as ListingTypeConfig[]

    return NextResponse.json({
      siteId: DEFAULT_SITE_ID,
      listingTypes: configs,
    })
  } catch (error) {
    logger.error('Error interno obteniendo listing_types de ML', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
