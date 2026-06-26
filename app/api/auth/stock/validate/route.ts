import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { products } from '@/lib/schema'
import { inArray } from 'drizzle-orm'

export async function POST(req: Request) {
  try {
    const { items } = await req.json() as { items: { id: number; quantity: number }[] }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
    }

    // Extraer IDs como number (coherente con schema)
    const ids = items.map(i => i.id)

    // Query batch para traer stock actual
    const stocks = await db
      .select({ id: products.id, stock: products.stock })
      .from(products)
      .where(inArray(products.id, ids))

    const stockMap = new Map(stocks.map(s => [s.id, s.stock]))

    const outOfStock: { id: number; availableStock: number }[] = []

    for (const item of items) {
      const currentStock = stockMap.get(item.id) ?? 0
      if (item.quantity > currentStock) {
        outOfStock.push({ id: item.id, availableStock: currentStock })
      }
    }

    return NextResponse.json({
      valid: outOfStock.length === 0,
      outOfStock,
    })
  } catch (error) {
    console.error('Error validating stock:', error)
    return NextResponse.json(
      { error: 'Error al validar el stock' },
      { status: 500 }
    )
  }
}