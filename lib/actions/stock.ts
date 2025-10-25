import { db } from '@/lib/db'
import { stockLogs, products } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function adjustStock(productId: number, newStock: number, reason: string, userId: number) {
  const product = await db.select().from(products).where(eq(products.id, productId)).limit(1)
  if (!product.length) throw new Error('Product not found')

  const oldStock = product[0].stock
  const change = newStock - oldStock

  // Actualizar stock del producto
  await db.update(products).set({ stock: newStock }).where(eq(products.id, productId))

  // Registrar en el historial
  await db.insert(stockLogs).values({
    productId,
    oldStock,
    newStock,
    change,
    reason,
    userId,
  })

  return { oldStock, newStock, change }
}

export async function getStockLogs(productId?: number, limit = 50) {
  const query = db.select({
    id: stockLogs.id,
    productId: stockLogs.productId,
    productName: products.name,
    oldStock: stockLogs.oldStock,
    newStock: stockLogs.newStock,
    change: stockLogs.change,
    reason: stockLogs.reason,
    created_at: stockLogs.created_at,
  })
    .from(stockLogs)
    .leftJoin(products, eq(stockLogs.productId, products.id))
    .orderBy(stockLogs.created_at)

  if (productId) {
    query.where(eq(stockLogs.productId, productId))
  }

  return query.limit(limit)
}

export async function getLowStockProducts(threshold = 10) {
  return db.select({
    id: products.id,
    name: products.name,
    stock: products.stock,
    category: products.category,
  })
    .from(products)
    .where(eq(products.stock, threshold))
    .orderBy(products.stock)
}
