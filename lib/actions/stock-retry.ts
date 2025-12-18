// lib/actions/stock-retry.ts
// Sistema de retry para errores de stock con backoff exponencial

import { db } from '@/lib/db';
import { products, productVariants, stockLogs } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

interface StockRetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

const DEFAULT_CONFIG: StockRetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 segundo
  maxDelay: 10000, // 10 segundos máximo
};

interface StockAdjustmentItem {
  productId: number;
  variantId?: number;
  quantity: number;
  change: number;
  reason: string;
  userId?: number;
}

/**
 * Realiza ajuste de stock con retry automático
 */
export async function adjustStockWithRetry(
  item: StockAdjustmentItem,
  config: Partial<StockRetryConfig> = {}
): Promise<{ success: boolean; attempts: number; error?: string }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      if (item.variantId) {
        await adjustVariantStock(item.variantId, item.productId, item.change, item.reason, item.userId);
      } else {
        await adjustProductStock(item.productId, item.change, item.reason, item.userId);
      }

      if (attempt > 1) {
        logger.info('[Stock-Retry] Ajuste de stock exitoso después de reintentos', {
          productId: item.productId,
          variantId: item.variantId,
          change: item.change,
          attempt,
          totalAttempts: finalConfig.maxRetries,
        });
      }

      return { success: true, attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      
      // Si es el último intento, loggear como error
      if (attempt === finalConfig.maxRetries) {
        logger.error('[Stock-Retry] Todos los reintentos fallaron', {
          productId: item.productId,
          variantId: item.variantId,
          change: item.change,
          attempts: attempt,
          error: lastError,
        });
      } else {
        // Calcular delay con backoff exponencial
        const delay = Math.min(
          finalConfig.baseDelay * Math.pow(2, attempt - 1),
          finalConfig.maxDelay
        );
        
        logger.warn('[Stock-Retry] Error en ajuste de stock - reintentando', {
          productId: item.productId,
          variantId: item.variantId,
          change: item.change,
          attempt,
          maxAttempts: finalConfig.maxRetries,
          nextRetryIn: `${delay}ms`,
          error: lastError,
        });

        // Esperar antes del próximo intento
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, attempts: finalConfig.maxRetries, error: lastError };
}

/**
 * Ajusta stock de variante con verificación de concurrencia
 */
async function adjustVariantStock(
  variantId: number,
  productId: number,
  change: number,
  reason: string,
  userId?: number
): Promise<void> {
  // Obtener stock actual
  const currentVariant = await db
    .select({ stock: productVariants.stock, isActive: productVariants.isActive })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!currentVariant.length) {
    throw new Error(`Variante ${variantId} no encontrada`);
  }

  const oldStock = currentVariant[0].stock;

  // Ajustar con verificación atómica
  await db
    .update(productVariants)
    .set({
      stock: sql`GREATEST(0, ${productVariants.stock} + ${change})`,
      isActive: sql`CASE WHEN GREATEST(0, ${productVariants.stock} + ${change}) > 0 THEN true ELSE false END`,
      updated_at: new Date()
    })
    .where(eq(productVariants.id, variantId));

  // Obtener nuevo stock para logging
  const updatedVariant = await db
    .select({ stock: productVariants.stock })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  // Registrar en logs
  if (typeof userId === 'number') {
    await db.insert(stockLogs).values({
      productId,
      variantId,
      oldStock,
      newStock: updatedVariant[0]?.stock || 0,
      change,
      reason,
      userId,
    });
  }
}

/**
 * Ajusta stock de producto con verificación de concurrencia
 */
async function adjustProductStock(
  productId: number,
  change: number,
  reason: string,
  userId?: number
): Promise<void> {
  // Obtener stock actual
  const currentProduct = await db
    .select({ stock: products.stock })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!currentProduct.length) {
    throw new Error(`Producto ${productId} no encontrado`);
  }

  const oldStock = currentProduct[0].stock;

  // Ajustar con verificación atómica
  await db
    .update(products)
    .set({ 
      stock: sql`GREATEST(0, ${products.stock} + ${change})`,
      updated_at: new Date() 
    })
    .where(eq(products.id, productId));

  // Obtener nuevo stock para logging
  const updatedProduct = await db
    .select({ stock: products.stock })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  // Registrar en logs
  if (typeof userId === 'number') {
    await db.insert(stockLogs).values({
      productId,
      oldStock,
      newStock: updatedProduct[0]?.stock || 0,
      change,
      reason,
      userId,
    });
  }
}
