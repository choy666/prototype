import { db } from '@/lib/db'
import { stockLogs, products, productVariants, users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'

export async function adjustStock(productId: number, newStock: number, reason: string, userId: number) {
  // Validaciones más estrictas
  if (!productId || isNaN(productId) || productId <= 0) {
    throw new Error('ID de producto inválido')
  }
  if (!userId || isNaN(userId) || userId <= 0) {
    throw new Error('ID de usuario inválido')
  }
  if (newStock < 0) {
    throw new Error('El stock no puede ser negativo')
  }
  if (newStock > 999999) {
    throw new Error('El stock no puede exceder 999,999 unidades')
  }
  if (!reason || reason.trim().length === 0) {
    throw new Error('La razón del cambio es requerida')
  }

  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        // Verificar que el usuario existe
        const user = await tx.select().from(users).where(eq(users.id, userId)).limit(1)
        if (!user.length) {
          throw new Error('Usuario no encontrado')
        }

        // Lock optimista: verificar stock actual
        const product = await tx.select().from(products).where(eq(products.id, productId)).limit(1)
        if (!product.length) throw new Error('Producto no encontrado')

        const oldStock = product[0].stock
        const change = newStock - oldStock

        // Actualizar stock del producto
        await tx.update(products).set({ stock: newStock }).where(eq(products.id, productId))

        // Registrar en el historial con metadata adicional
        await tx.insert(stockLogs).values({
          productId,
          oldStock,
          newStock,
          change,
          reason: reason.trim(),
          userId,
        })

        // Log detallado de la operación
        logger.info('Stock adjusted successfully', {
          productId,
          oldStock,
          newStock,
          change,
          reason: reason.trim(),
          userId,
          attempt,
          operation: 'adjustStock'
        })

        return { oldStock, newStock, change }
      })
    } catch (error) {
      lastError = error as Error
      logger.warn('Stock adjustment attempt failed', {
        productId,
        newStock,
        reason,
        userId,
        attempt,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      // Si es el último intento, lanzar el error
      if (attempt === maxRetries) {
        logger.error('Stock adjustment failed after all retries', {
          productId,
          newStock,
          reason,
          userId,
          attempts: maxRetries,
          error: lastError.message
        })
        throw lastError
      }

      // Esperar antes del siguiente intento (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100))
    }
  }

  throw lastError || new Error('Error desconocido en ajuste de stock')
}

export async function adjustVariantStock(variantId: number, newStock: number, reason: string, userId: number) {
  // Validaciones más estrictas
  if (!variantId || isNaN(variantId) || variantId <= 0) {
    throw new Error('ID de variante inválido')
  }
  if (!userId || isNaN(userId) || userId <= 0) {
    throw new Error('ID de usuario inválido')
  }
  if (newStock < 0) {
    throw new Error('El stock no puede ser negativo')
  }
  if (newStock > 999999) {
    throw new Error('El stock no puede exceder 999,999 unidades')
  }
  if (!reason || reason.trim().length === 0) {
    throw new Error('La razón del cambio es requerida')
  }

  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
          reason: reason.trim(),
          userId,
        })

        // Log detallado de la operación
        logger.info('Variant stock adjusted successfully', {
          variantId,
          productId: variant[0].productId,
          oldStock,
          newStock,
          change,
          reason: reason.trim(),
          userId,
          attempt,
          operation: 'adjustVariantStock'
        })

        return { oldStock, newStock, change }
      })
    } catch (error) {
      lastError = error as Error
      logger.warn('Variant stock adjustment attempt failed', {
        variantId,
        newStock,
        reason,
        userId,
        attempt,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      // Si es el último intento, lanzar el error
      if (attempt === maxRetries) {
        logger.error('Variant stock adjustment failed after all retries', {
          variantId,
          newStock,
          reason,
          userId,
          attempts: maxRetries,
          error: lastError.message
        })
        throw lastError
      }

      // Esperar antes del siguiente intento (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100))
    }
  }

  throw lastError || new Error('Error desconocido en ajuste de stock de variante')
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

  // Validaciones más estrictas
  if (!userId || isNaN(userId) || userId <= 0) {
    throw new Error('ID de usuario inválido')
  }
  if (!reason || reason.trim().length === 0) {
    throw new Error('La razón del cambio es requerida')
  }

  // Validar todas las variantes antes de procesar
  for (const { variantId, newStock } of variants) {
    if (!variantId || isNaN(variantId) || variantId <= 0) {
      throw new Error(`ID de variante inválido: ${variantId}`)
    }
    if (newStock < 0) {
      throw new Error(`El stock no puede ser negativo para variante ${variantId}`)
    }
    if (newStock > 999999) {
      throw new Error(`El stock no puede exceder 999,999 unidades para variante ${variantId}`)
    }
  }

  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const results = await db.transaction(async (tx) => {
        // Verificar usuario
        const user = await tx.select().from(users).where(eq(users.id, userId)).limit(1)
        if (!user.length) {
          throw new Error('Usuario no encontrado')
        }

        const updateResults: Array<{ variantId: number; oldStock: number; newStock: number; change: number }> = []

        for (const { variantId, newStock } of variants) {
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
            reason: reason.trim(),
            userId,
          })

          updateResults.push({ variantId, oldStock, newStock, change })
        }

        return updateResults
      })

      // Log detallado de la operación bulk
      logger.info('Bulk variant stock adjusted successfully', {
        variantCount: variants.length,
        variants: variants.map(v => ({ variantId: v.variantId, newStock: v.newStock })),
        reason: reason.trim(),
        userId,
        attempt,
        operation: 'bulkAdjustVariantStock'
      })

      return results
    } catch (error) {
      lastError = error as Error
      logger.warn('Bulk variant stock adjustment attempt failed', {
        variantCount: variants.length,
        variants: variants.map(v => ({ variantId: v.variantId, newStock: v.newStock })),
        reason,
        userId,
        attempt,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      // Si es el último intento, lanzar el error
      if (attempt === maxRetries) {
        logger.error('Bulk variant stock adjustment failed after all retries', {
          variantCount: variants.length,
          variants: variants.map(v => ({ variantId: v.variantId, newStock: v.newStock })),
          reason,
          userId,
          attempts: maxRetries,
          error: lastError.message
        })
        throw lastError
      }

      // Esperar antes del siguiente intento (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100))
    }
  }

  throw lastError || new Error('Error desconocido en ajuste bulk de stock de variantes')
}
