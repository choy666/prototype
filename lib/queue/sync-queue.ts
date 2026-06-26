import { db } from '@/lib/db';
import { mercadolibreProductsSync, products } from '@/lib/schema';
import { eq, and, lt, gte, desc } from 'drizzle-orm';
import { syncProductToMercadoLibre } from '@/lib/actions/products';
import { logger } from '@/lib/utils/logger';

// Estados de sincronización
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error' | 'retrying';

// Prioridades de la cola
export type SyncPriority = 'low' | 'normal' | 'high' | 'critical';

// Configuración de la cola
const SYNC_QUEUE_CONFIG = {
  // Máximo de reintentos automáticos
  maxRetries: 5,
  // Backoff exponencial base (en minutos)
  baseRetryDelay: 5,
  // Máximo de reintentos por lote
  maxBatchSize: 10,
  // Tiempo máximo para procesar un item (en minutos)
  maxProcessingTime: 30,
  // Límite de items concurrentes
  maxConcurrentSyncs: 3,
};


/**
 * Agrega un producto a la cola de sincronización
 */
export async function addToSyncQueue(
  productId: number,
  priority: SyncPriority = 'normal',
  delayMinutes: number = 0
): Promise<void> {
  try {
    // Verificar si ya existe en la cola
    const existing = await db.query.mercadolibreProductsSync.findFirst({
      where: eq(mercadolibreProductsSync.productId, productId),
    });

    if (existing) {
      // Actualizar item existente
      await db.update(mercadolibreProductsSync)
        .set({
          syncStatus: existing.syncStatus === 'error' ? 'pending' : 'pending',
          syncAttempts: existing.syncStatus === 'error' ? existing.syncAttempts : 0,
          syncError: null,
          updatedAt: new Date(),
        })
        .where(eq(mercadolibreProductsSync.id, existing.id));

      logger.info('SyncQueue: Item actualizado en cola', {
        productId,
        previousStatus: existing.syncStatus,
        newStatus: existing.syncStatus === 'error' ? 'pending' : 'pending',
        priority,
        delayMinutes
      });
    } else {
      // Crear nuevo item
      await db.insert(mercadolibreProductsSync)
        .values({
          productId,
          syncStatus: 'pending',
          syncAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      logger.info('SyncQueue: Nuevo item agregado a cola', {
        productId,
        priority,
        delayMinutes
      });
    }
  } catch (error) {
    logger.error('SyncQueue: Error agregando item a cola', {
      productId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Obtiene los siguientes items de la cola para procesar
 */
export async function getNextBatchFromQueue(
  batchSize: number = SYNC_QUEUE_CONFIG.maxBatchSize
): Promise<{ id: number; productId: number }[]> {
  try {
    // Obtener items pendientes con join a products para filtrar activos
    const items = await db
      .select({
        id: mercadolibreProductsSync.id,
        productId: mercadolibreProductsSync.productId,
      })
      .from(mercadolibreProductsSync)
      .innerJoin(products, eq(mercadolibreProductsSync.productId, products.id))
      .where(and(
        eq(mercadolibreProductsSync.syncStatus, 'pending'),
        eq(products.isActive, true),
        gte(products.stock, 1) // Solo sincronizar productos con stock
      ))
      .orderBy(desc(mercadolibreProductsSync.updatedAt))
      .limit(batchSize);

    logger.info('SyncQueue: Items obtenidos de cola', {
      requested: batchSize,
      obtained: items.length
    });

    return items;
  } catch (error) {
    logger.error('SyncQueue: Error obteniendo items de cola', {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

/**
 * Marca un item como en proceso
 */
export async function markAsProcessing(syncId: number): Promise<void> {
  try {
    await db.update(mercadolibreProductsSync)
      .set({
        syncStatus: 'syncing',
        updatedAt: new Date(),
      })
      .where(eq(mercadolibreProductsSync.id, syncId));

    logger.debug('SyncQueue: Item marcado como procesando', { syncId });
  } catch (error) {
    logger.error('SyncQueue: Error marcando item como procesando', {
      syncId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Marca un item como completado exitosamente
 */
export async function markAsCompleted(
  syncId: number,
  mlItemId: string,
  mlData: unknown
): Promise<void> {
  try {
    await db.update(mercadolibreProductsSync)
      .set({
        mlItemId,
        syncStatus: 'synced',
        mlData,
        lastSyncAt: new Date(),
        syncError: null,
        updatedAt: new Date(),
      })
      .where(eq(mercadolibreProductsSync.id, syncId));

    logger.info('SyncQueue: Item marcado como completado', {
      syncId,
      mlItemId
    });
  } catch (error) {
    logger.error('SyncQueue: Error marcando item como completado', {
      syncId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Marca un item como fallido y programa reintento si es necesario
 */
export async function markAsFailed(
  syncId: number,
  error: string,
  retryCount: number
): Promise<void> {
  try {
    const shouldRetry = retryCount < SYNC_QUEUE_CONFIG.maxRetries;

    await db.update(mercadolibreProductsSync)
      .set({
        syncStatus: shouldRetry ? 'pending' : 'error',
        syncAttempts: retryCount,
        syncError: error,
        updatedAt: new Date(),
      })
      .where(eq(mercadolibreProductsSync.id, syncId));

    logger.warn('SyncQueue: Item marcado como fallido', {
      syncId,
      error,
      retryCount,
      shouldRetry
    });
  } catch (queueError) {
    logger.error('SyncQueue: Error marcando item como fallido', {
      syncId,
      error,
      retryCount,
      queueError: queueError instanceof Error ? queueError.message : String(queueError)
    });
  }
}


/**
 * Procesa un lote de items de la cola
 */
export async function processBatch(userId: number): Promise<{
  processed: number;
  successful: number;
  failed: number;
}> {
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
  };

  try {
    logger.info('SyncQueue: Iniciando procesamiento de lote', { userId });

    const batch = await getNextBatchFromQueue();
    
    if (batch.length === 0) {
      logger.info('SyncQueue: No hay items para procesar');
      return results;
    }

    // Procesar items en paralelo pero con límite de concurrencia
    const chunks = chunkArray(batch, SYNC_QUEUE_CONFIG.maxConcurrentSyncs);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (item) => {
        try {
          // Marcar como en proceso
          await markAsProcessing(item.id);
          results.processed++;

          // Sincronizar producto
          const syncResult = await syncProductToMercadoLibre(
            item.productId,
            userId,
            0 // No usar reintentos aquí, la cola maneja los reintentos
          );

          if (syncResult.success) {
            await markAsCompleted(item.id, syncResult.mlItemId!, null);
            results.successful++;
            
            logger.info('SyncQueue: Producto sincronizado exitosamente', {
              syncId: item.id,
              productId: item.productId,
              mlItemId: syncResult.mlItemId
            });
          } else {
            await markAsFailed(item.id, syncResult.error || 'Error desconocido', 1);
            results.failed++;
            
            logger.warn('SyncQueue: Falló sincronización de producto', {
              syncId: item.id,
              productId: item.productId,
              error: syncResult.error
            });
          }
        } catch (error) {
          await markAsFailed(item.id, error instanceof Error ? error.message : String(error), 1);
          results.failed++;
          
          logger.error('SyncQueue: Error procesando item', {
            syncId: item.id,
            productId: item.productId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      // Esperar a que termine el chunk actual antes de procesar el siguiente
      await Promise.all(promises);
    }

    logger.info('SyncQueue: Lote procesado', {
      userId,
      ...results
    });

    return results;
  } catch (error) {
    logger.error('SyncQueue: Error procesando lote', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return results;
  }
}

/**
 * Obtiene estadísticas de la cola
 */
export async function getQueueStats(): Promise<{
  pending: number;
  syncing: number;
  synced: number;
  error: number;
  retrying: number;
  total: number;
}> {
  try {
    const stats = await db.query.mercadolibreProductsSync.findMany({
      columns: {
        syncStatus: true,
      },
    });

    const result = {
      pending: 0,
      syncing: 0,
      synced: 0,
      error: 0,
      retrying: 0,
      total: stats.length,
    };

    stats.forEach(item => {
      result[item.syncStatus as keyof typeof result]++;
    });

    return result;
  } catch (error) {
    logger.error('SyncQueue: Error obteniendo estadísticas', {
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      pending: 0,
      syncing: 0,
      synced: 0,
      error: 0,
      retrying: 0,
      total: 0,
    };
  }
}

/**
 * Limpia items antiguos en estado 'synced'
 */
export async function cleanupOldSyncedItems(daysOld: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const result = await db
      .delete(mercadolibreProductsSync)
      .where(
        and(
          eq(mercadolibreProductsSync.syncStatus, 'synced'),
          lt(mercadolibreProductsSync.updatedAt, cutoffDate)
        )
      );

    const deletedCount = result.rowCount || 0;
    
    logger.info('SyncQueue: Limpieza completada', {
      daysOld,
      deletedCount
    });

    return deletedCount;
  } catch (error) {
    logger.error('SyncQueue: Error en limpieza', {
      daysOld,
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}

/**
 * Divide un array en chunks
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Reintenta items fallidos manualmente
 */
export async function retryFailedItems(productIds?: number[]): Promise<number> {
  try {
    if (productIds && productIds.length > 0) {
      // Reintentar items específicos - necesitaríamos implementar con 'in' clause
      // Por ahora, retornamos 0 como placeholder
      return 0;
    } else {
      // Reintentar todos los items fallidos
      const result = await db
        .update(mercadolibreProductsSync)
        .set({
          syncStatus: 'pending',
          syncAttempts: 0,
          syncError: null,
          updatedAt: new Date(),
        })
        .where(eq(mercadolibreProductsSync.syncStatus, 'error'));

      const updatedCount = result.rowCount || 0;

      logger.info('SyncQueue: Items fallidos marcados para reintento', {
        productIds: productIds || 'all',
        updatedCount
      });

      return updatedCount;
    }
  } catch (error) {
    logger.error('SyncQueue: Error reintentando items fallidos', {
      productIds,
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}
