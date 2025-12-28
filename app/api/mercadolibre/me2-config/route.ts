import { NextResponse } from 'next/server'
import { getME2Config } from '@/lib/config/integrations'
import { logger } from '@/lib/utils/logger'

export async function GET() {
  try {
    const config = getME2Config()

    return NextResponse.json({
      minDimensions: config.minDimensions,
      maxDimensions: config.maxDimensions,
      defaultDimensions: config.defaultDimensions,
      packagingCost: config.packagingCost,
      handlingCost: config.handlingCost,
    })
  } catch (error) {
    logger.error('Error obteniendo configuración ME2', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
