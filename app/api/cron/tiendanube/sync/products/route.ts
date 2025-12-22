import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores, tiendanubeProductMapping, tiendanubeSyncState, products, productVariants } from '@/lib/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { createClientForStore } from '@/lib/services/tiendanube/client';

export const runtime = 'nodejs';

// Configuración de rate limiting
const SYNC_BATCH_SIZE = 20;
const SYNC_DELAY_MS = 500;
const MAX_SYNC_TIME_MS = 5 * 60 * 1000;

// Validar CRON_SECRET
function validateCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  const expectedSecret = process.env.CRON_SECRET;
  
  if (!expectedSecret) {
    logger.error('CRON_SECRET no configurado');
    return false;
  }
  
  return secret === expectedSecret;
}

async function syncProductToTiendanube(
  storeId: string,
  mapping: typeof tiendanubeProductMapping.$inferSelect,
  product: typeof products.$inferSelect & { variant?: typeof productVariants.$inferSelect }
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await createClientForStore(storeId);
    
    const payload: {
      name: string;
      description: string;
      price: number;
      stock: number;
      sku: string;
      variants?: Array<{
        id: string;
        price: number;
        stock: number;
        sku: string;
      }>;
    } = {
      name: product.name,
      description: product.description || '',
      price: Number(product.price),
      stock: product.stock || 0,
      sku: mapping.sku,
    };

    if (mapping.localVariantId && product.variant) {
      payload.variants = [{
        id: mapping.tiendanubeVariantId || '',
        price: Number(product.variant.price),
        stock: product.variant.stock || 0,
        sku: mapping.sku,
      }];
    }

    if (mapping.tiendanubeProductId) {
      await client.put(`/products/${mapping.tiendanubeProductId}`, payload);
    } else {
      const newProduct = await client.post('/products', payload) as { id: number };
      await db
        .update(tiendanubeProductMapping)
        .set({
          tiendanubeProductId: newProduct.id.toString(),
          syncStatus: 'synced',
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tiendanubeProductMapping.id, mapping.id));
    }

    await db
      .update(tiendanubeProductMapping)
      .set({
        syncStatus: 'synced',
        lastSyncAt: new Date(),
        lastError: null,
        consecutiveFailures: 0,
        updatedAt: new Date(),
      })
      .where(eq(tiendanubeProductMapping.id, mapping.id));

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await db
      .update(tiendanubeProductMapping)
      .set({
        syncStatus: 'error',
        lastError: errorMessage,
        consecutiveFailures: sql`${tiendanubeProductMapping.consecutiveFailures} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tiendanubeProductMapping.id, mapping.id));

    logger.error('Error sincronizando producto a Tiendanube (cron)', {
      storeId,
      productId: mapping.localProductId,
      sku: mapping.sku,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Validar autenticación del cron
  if (!validateCronSecret(req)) {
    logger.error('Intento de acceso no autorizado al endpoint de cron', {
      userAgent: req.headers.get('user-agent'),
    });
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    // Obtener todas las tiendas conectadas
    const stores = await db.query.tiendanubeStores.findMany({
      where: eq(tiendanubeStores.status, 'connected'),
    });

    if (stores.length === 0) {
      logger.info('No hay tiendas conectadas para sincronizar');
      return NextResponse.json({ message: 'No hay tiendas conectadas' });
    }

    const totalResult = {
      storesProcessed: 0,
      totalUpdated: 0,
      totalFailed: 0,
      totalSkipped: 0,
      errors: [] as Array<{ storeId: string; error: string }>,
    };

    // Procesar cada tienda
    for (const store of stores) {
      try {
        logger.info('Iniciando sincronización automática', { storeId: store.storeId });

        // Verificar cooldown por tienda
        const syncState = await db.query.tiendanubeSyncState.findFirst({
          where: eq(tiendanubeSyncState.storeId, store.storeId),
        });

        if (syncState?.lastSyncedAt) {
          const timeSinceLastSync = Date.now() - new Date(syncState.lastSyncedAt).getTime();
          if (timeSinceLastSync < 10 * 60 * 1000) { // 10 minutos de cooldown
            logger.info('Tienda en cooldown, omitiendo', { storeId: store.storeId });
            continue;
          }
        }

        // Obtener productos para sincronizar
        const mappingsToSync = await db
          .select({
            mapping: tiendanubeProductMapping,
            product: products,
            variant: productVariants,
          })
          .from(tiendanubeProductMapping)
          .leftJoin(products, eq(tiendanubeProductMapping.localProductId, products.id))
          .leftJoin(productVariants, eq(tiendanubeProductMapping.localVariantId, productVariants.id))
          .where(and(
            eq(tiendanubeProductMapping.storeId, store.storeId),
            sql`COALESCE(${tiendanubeProductMapping.consecutiveFailures}, 0) < 5`,
            // Solo productos actualizados recientemente (última hora)
            gte(products.updated_at, new Date(Date.now() - 60 * 60 * 1000))
          ))
          .limit(SYNC_BATCH_SIZE);

        const storeResult = {
          updated: 0,
          failed: 0,
          skipped: 0,
        };

        // Sincronizar productos
        for (const { mapping, product, variant } of mappingsToSync) {
          if (Date.now() - startTime > MAX_SYNC_TIME_MS) break;

          if (!product) {
            storeResult.skipped++;
            continue;
          }

          const syncResult = await syncProductToTiendanube(
            store.storeId,
            mapping,
            { ...product, variant: variant || undefined }
          );

          if (syncResult.success) {
            storeResult.updated++;
          } else {
            storeResult.failed++;
          }

          await delay(SYNC_DELAY_MS);
        }

        // Actualizar estado de sincronización
        await db
          .insert(tiendanubeSyncState)
          .values({
            storeId: store.storeId,
            resource: 'products',
            lastSyncedAt: new Date(),
            lastError: storeResult.failed > 0 ? `${storeResult.failed} productos fallaron` : null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [tiendanubeSyncState.storeId, tiendanubeSyncState.resource],
            set: {
              lastSyncedAt: new Date(),
              lastError: storeResult.failed > 0 ? `${storeResult.failed} productos fallaron` : null,
              updatedAt: new Date(),
            },
          });

        totalResult.storesProcessed++;
        totalResult.totalUpdated += storeResult.updated;
        totalResult.totalFailed += storeResult.failed;
        totalResult.totalSkipped += storeResult.skipped;

        logger.info('Sincronización de tienda completada', {
          storeId: store.storeId,
          result: storeResult,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        totalResult.errors.push({
          storeId: store.storeId,
          error: errorMessage,
        });
        logger.error('Error sincronizando tienda', {
          storeId: store.storeId,
          error: errorMessage,
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Sincronización automática completada', {
      ...totalResult,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      success: true,
      result: totalResult,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error en sincronización automática', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration}ms`,
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
