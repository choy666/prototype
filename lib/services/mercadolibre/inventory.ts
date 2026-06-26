import { db, checkDatabaseConnection } from '@/lib/db';
import { products, type Product } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';
import { calculateAvailableQuantityFromProduct } from '@/lib/domain/ml-stock';

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

        // Obtener stock real local y cantidad calculada para ML
        const currentStock = product.stock || 0;
        const availableQuantity = calculateAvailableQuantityFromProduct(product as Product);

        // Actualizar en Mercado Libre usando available_quantity calculado
        const response = await makeAuthenticatedRequest(
          userId,
          `/items/${product.mlItemId}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              available_quantity: availableQuantity,
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
          stock: currentStock,
          availableQuantity,
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

/**
 * Sincronización bidireccional de inventario (SOLO LECTURA Y MONITOREO)
 * Ya no sobreescribe el stock local con datos de ML para evitar inconsistencias.
 * Solo registra discrepancias y actualiza ML si el stock local es menor.
 */
export async function bidirectionalInventorySync(userId: number, productId: number): Promise<{
  localStock: number;
  mlStock: number;
  discrepancy: number;
  mlUpdated: boolean;
}> {
  try {
    await checkDatabaseConnection();

    // Obtener stock local
    const localProduct = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!localProduct || !localProduct.mlItemId) {
      throw new Error('Producto no encontrado o no sincronizado con ML');
    }

    const localStock = localProduct.stock;

    // Obtener stock de ML
    const mlResponse = await makeAuthenticatedRequest(
      userId,
      `/items/${localProduct.mlItemId}`,
      { method: 'GET' }
    );

    const mlData = await mlResponse.json();
    const mlStock = mlData.available_quantity || 0;

    // Calcular discrepancia
    const discrepancy = localStock - mlStock;

    // Registrar discrepancia si existe
    if (discrepancy !== 0) {
      logger.warn('Discrepancia detectada entre stock local y ML', {
        productId,
        localStock,
        mlStock,
        discrepancy,
        mlItemId: localProduct.mlItemId,
      });

      // Si el stock local es menor, actualizar ML para evitar sobreventa
      if (localStock < mlStock) {
        const availableQuantity = calculateAvailableQuantityFromProduct(localProduct as Product);
        await makeAuthenticatedRequest(
          userId,
          `/items/${localProduct.mlItemId}`,
          { 
            method: 'PUT', 
            body: JSON.stringify({ available_quantity: availableQuantity }) 
          }
        );
        logger.info('Stock actualizado en ML para evitar sobreventa', {
          productId,
          newAvailableQuantity: availableQuantity,
        });
        return { localStock, mlStock, discrepancy, mlUpdated: true };
      }
    }

    return { localStock, mlStock, discrepancy, mlUpdated: false };
  } catch (error) {
    logger.error('Error en monitoreo de inventario bidireccional', {
      productId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
