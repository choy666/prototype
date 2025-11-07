import { db } from '@/lib/db'
import { stockLogs, products, productVariants, users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'

export async function adjustStock(productId: number, newStock: number, reason: string, userId: number) {
  // Validar que productId sea válido
  if (!productId || isNaN(productId) || productId <= 0) {
    throw new Error('ID de producto inválido')
  }

  // Validar que userId sea válido
  if (!userId || isNaN(userId) || userId <= 0) {
    throw new Error('ID de usuario inválido')
  }

  try {
    return await db.transaction(async (tx) => {
      // Verificar que el usuario existe
      const user = await tx.select().from(users).where(eq(users.id, userId)).limit(1)
      if (!user.length) {
        throw new Error('Usuario no encontrado')
      }

      const product = await tx.select().from(products).where(eq(products.id, productId)).limit(1)
      if (!product.length) throw new Error('Producto no encontrado')

      const oldStock = product[0].stock
      const change = newStock - oldStock

      // Actualizar stock del producto
      await tx.update(products).set({ stock: newStock }).where(eq(products.id, productId))

      // Registrar en el historial
      await tx.insert(stockLogs).values({
        productId,
        oldStock,
        newStock,
        change,
        reason,
        userId,
      })

      return { oldStock, newStock, change }
    })
  } catch (error) {
    logger.error('Error adjusting stock for product', {
      productId,
      newStock,
      reason,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

export async function adjustVariantStock(variantId: number, newStock: number, reason: string, userId: number) {
  // Validar que variantId sea válido
  if (!variantId || isNaN(variantId) || variantId <= 0) {
    throw new Error('ID de variante inválido')
  }

  // Validar que userId sea válido
  if (!userId || isNaN(userId) || userId <= 0) {
    throw new Error('ID de usuario inválido')
  }

  try {
    return await db.transaction(async (tx) => {
      // Verificar que el usuario existe
      const user = await tx.select().from(users).where(eq(users.id, userId)).limit(1)
      if (!user.length) {
        throw new Error('Usuario no encontrado')
      }

      const variant = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1)
      if (!variant.length) throw new Error('Variante no encontrada')

      const oldStock = variant[0].stock
      const change = newStock - oldStock

      // Actualizar stock de la variante
      await tx.update(productVariants).set({ stock: newStock }).where(eq(productVariants.id, variantId))

      // Registrar en el historial (usando productId de la variante)
      await tx.insert(stockLogs).values({
        productId: variant[0].productId,
        oldStock,
        newStock,
        change,
        reason,
        userId,
      })

      return { oldStock, newStock, change }
    })
  } catch (error) {
    logger.error('Error adjusting stock for variant', {
      variantId,
      newStock,
      reason,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

export async function deductStock(productId: number, variantId: number | null, quantity: number, userId: number) {
  if (variantId) {
    // Deduct from variant
    const variant = await db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1)
    if (!variant.length) throw new Error('Variant not found')

    const newStock = variant[0].stock - quantity
    if (newStock < 0) throw new Error('Insufficient stock for variant')

    await adjustVariantStock(variantId, newStock, 'Venta', userId)
  } else {
    // Deduct from product
    const product = await db.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!product.length) throw new Error('Product not found')

    const newStock = product[0].stock - quantity
    if (newStock < 0) throw new Error('Insufficient stock for product')

    await adjustStock(productId, newStock, 'Venta', userId)
  }
}

export async function getStockLogs(productId?: number, limit = 50, offset = 0) {
  const query = db.select({
    id: stockLogs.id,
    productId: stockLogs.productId,
    productName: products.name,
    oldStock: stockLogs.oldStock,
    newStock: stockLogs.newStock,
    change: stockLogs.change,
    reason: stockLogs.reason,
    created_at: stockLogs.created_at,
    userName: users.name,
  })
    .from(stockLogs)
    .leftJoin(products, eq(stockLogs.productId, products.id))
    .leftJoin(users, eq(stockLogs.userId, users.id))
    .orderBy(stockLogs.created_at)

  if (productId) {
    query.where(eq(stockLogs.productId, productId))
  }

  return query.limit(limit).offset(offset)
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

// Nueva función para bulk update de variantes (mejora UX)
export async function bulkAdjustVariantStock(
  variants: Array<{ variantId: number; newStock: number }>,
  reason: string,
  userId: number
) {
  if (!variants.length) {
    throw new Error('No variants provided for bulk update')
  }

  // Validar userId
  if (!userId || isNaN(userId) || userId <= 0) {
    throw new Error('ID de usuario inválido')
  }

  try {
    const results = await db.transaction(async (tx) => {
      // Verificar usuario
      const user = await tx.select().from(users).where(eq(users.id, userId)).limit(1)
      if (!user.length) {
        throw new Error('Usuario no encontrado')
      }

      const updateResults: Array<{ variantId: number; oldStock: number; newStock: number; change: number }> = []

      for (const { variantId, newStock } of variants) {
        if (!variantId || isNaN(variantId) || variantId <= 0) {
          throw new Error(`ID de variante inválido: ${variantId}`)
        }

        const variant = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1)
        if (!variant.length) throw new Error(`Variante no encontrada: ${variantId}`)

        const oldStock = variant[0].stock
        const change = newStock - oldStock

        // Actualizar
        await tx.update(productVariants).set({ stock: newStock }).where(eq(productVariants.id, variantId))

        // Log
        await tx.insert(stockLogs).values({
          productId: variant[0].productId,
          oldStock,
          newStock,
          change,
          reason,
          userId,
        })

        updateResults.push({ variantId, oldStock, newStock, change })
      }

      return updateResults
    })

    return results
  } catch (error) {
    logger.error('Error in bulk adjust variant stock', {
      variants: variants.map(v => ({ variantId: v.variantId, newStock: v.newStock })),
      reason,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}
