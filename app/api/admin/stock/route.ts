import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { adjustStock, getStockLogs, getLowStockProducts } from '@/lib/actions/stock'
import { z } from 'zod'

const adjustStockSchema = z.object({
  productId: z.number().int().positive(),
  newStock: z.number().int().min(0),
  reason: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = adjustStockSchema.parse(body)

    const result = await adjustStock(
      validatedData.productId,
      validatedData.newStock,
      validatedData.reason,
      parseInt(session.user.id)
    )

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error adjusting stock:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId') ? parseInt(searchParams.get('productId')!) : undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const lowStock = searchParams.get('lowStock') === 'true'

    if (lowStock) {
      const threshold = parseInt(searchParams.get('threshold') || '10')
      const products = await getLowStockProducts(threshold)
      return NextResponse.json(products)
    }

    const logs = await getStockLogs(productId, limit)
    return NextResponse.json(logs)
  } catch (error) {
    console.error('Error fetching stock data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
