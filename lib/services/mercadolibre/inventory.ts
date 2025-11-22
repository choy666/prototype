import { db } from '@/lib/db';
import { products, stockLogs } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';

export async function syncInventoryToMercadoLibre(
  userId: number,
  productId?: number
): Promise<{ success: boolean; synced: number; errors: number }> {
  try {
    let synced = 0;
    let errors = 0;

    // Obtener productos para sincronizar
    const productsToSync = productId 
      ? await db.query.products.findMany({
          where: eq(products.id, productId),
        })
      : await db.query.products.findMany({
          where: and(
            eq(products.mlSyncStatus, 'synced'),
            eq(products.isActive, true)
          ),
        });

    logger.info('Iniciando sincronización de inventario', {
      userId,
      productCount: productsToSync.length
    });

    for (const product of productsToSync) {
      try {
        if (!product.mlItemId) {
          logger.warn('Producto sin ML item ID', { productId: product.id });
          continue;
        }

        // Obtener stock actual
        const currentStock = product.stock || 0;

        // Actualizar en Mercado Libre
        const response = await makeAuthenticatedRequest(
          userId,
          `/items/${product.mlItemId}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              available_quantity: currentStock,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Error actualizando stock en ML: ${error}`);
        }

        // Actualizar timestamp
        await db.update(products)
          .set({
            mlLastSync: new Date(),
            updated_at: new Date()
          })
          .where(eq(products.id, product.id));

        synced++;

        logger.info('Stock sincronizado', {
          productId: product.id,
          mlItemId: product.mlItemId,
          stock: currentStock
        });

      } catch (error) {
        errors++;
        logger.error('Error sincronizando stock de producto', {
          productId: product.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { success: true, synced, errors };

  } catch (error) {
    logger.error('Error en sincronización de inventario', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return { success: false, synced: 0, errors: 0 };
  }
}

export async function bidirectionalInventorySync(
  userId: number,
  productId: number
): Promise<{ success: boolean; source: 'local' | 'ml'; error?: string }> {
  try {
    // Obtener producto local
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product?.mlItemId) {
      return { success: false, source: 'local' as const, error: 'Producto no sincronizado con ML' };
    }

    // Obtener stock desde Mercado Libre
    const response = await makeAuthenticatedRequest(
      userId,
      `/items/${product.mlItemId}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error obteniendo stock de ML: ${error}`);
    }

    const mlItem = await response.json();
    const mlStock = mlItem.available_quantity || 0;
    const localStock = product.stock || 0;

    // Comparar stocks
    if (localStock !== mlStock) {
      logger.warn('Diferencia de stock detectada', {
        productId,
        localStock,
        mlStock,
        mlItemId: product.mlItemId
      });

      // Estrategia: usar el stock más bajo para evitar sobreventa
      const newStock = Math.min(localStock, mlStock);

      // Actualizar local
      await db.update(products)
        .set({
          stock: newStock,
          updated_at: new Date()
        })
        .where(eq(products.id, productId));

      // Crear log de ajuste
      await db.insert(stockLogs).values({
        productId,
        oldStock: localStock,
        newStock,
        change: newStock - localStock,
        reason: 'Sincronización bidireccional ML',
        userId,
      });

      // Actualizar en ML si el stock local es menor
      if (localStock < mlStock) {
        await makeAuthenticatedRequest(
          userId,
          `/items/${product.mlItemId}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              available_quantity: localStock,
            }),
          }
        );

        return { success: true, source: 'local' };
      } else {
        return { success: true, source: 'ml' };
      }
    }

    return { success: true, source: 'local' };

  } catch (error) {
    logger.error('Error en sincronización bidireccional', {
      productId,
      error: error instanceof Error ? error.message : String(error)
    });
    return { 
      success: false, 
      source: 'local' as const,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
