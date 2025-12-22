import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { tiendanubeStores, tiendanubeProductMapping, tiendanubeSyncState, products, productVariants } from '@/lib/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { createClientForStore } from '@/lib/services/tiendanube/client';

export const runtime = 'nodejs';

// Configuración de rate limiting
const SYNC_BATCH_SIZE = 20; // productos por lote
const SYNC_DELAY_MS = 500; // delay entre llamadas API
const MAX_SYNC_TIME_MS = 5 * 60 * 1000; // 5 minutos máximo por ejecución

interface SyncResult {
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ productId: number; error: string }>;
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
      // Campos adicionales según API de Tiendanube
      sku: mapping.sku,
    };

    // Si es variante, incluir datos específicos
    if (mapping.localVariantId && product.variant) {
      payload.variants = [{
        id: mapping.tiendanubeVariantId || '',
        price: Number(product.variant.price),
        stock: product.variant.stock || 0,
        sku: mapping.sku,
      }];
    }

    // Actualizar producto en Tiendanube
    if (mapping.tiendanubeProductId) {
      await client.put(`/products/${mapping.tiendanubeProductId}`, payload);
    } else {
      // Crear nuevo producto si no existe
      const newProduct = await client.post('/products', payload) as { id: number };
      // Actualizar mapping con el nuevo ID
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

    // Actualizar estado del mapping
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
    
    // Incrementar contador de fallos consecutivos
    await db
      .update(tiendanubeProductMapping)
      .set({
        syncStatus: 'error',
        lastError: errorMessage,
        consecutiveFailures: sql`${tiendanubeProductMapping.consecutiveFailures} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tiendanubeProductMapping.id, mapping.id));

    logger.error('Error sincronizando producto a Tiendanube', {
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
  const session = await auth();
  const startTime = Date.now();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { storeId, force = false } = body;

    if (!storeId) {
      return NextResponse.json({ error: 'storeId requerido' }, { status: 400 });
    }

    // Verificar que la tienda exista y esté conectada
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, storeId),
    });

    if (!store || store.status !== 'connected') {
      return NextResponse.json({ error: 'Tienda no conectada' }, { status: 400 });
    }

    // Obtener estado de sincronización
    const syncState = await db.query.tiendanubeSyncState.findFirst({
      where: eq(tiendanubeSyncState.storeId, storeId),
    });

    // Verificar si ya se está sincronizando (evitar ejecuciones concurrentes)
    if (syncState?.lastSyncedAt && !force) {
      const timeSinceLastSync = Date.now() - new Date(syncState.lastSyncedAt).getTime();
      if (timeSinceLastSync < 5 * 60 * 1000) { // 5 minutos de cooldown
        return NextResponse.json({ 
          error: 'Sincronización en progreso o muy reciente',
          nextSyncAt: new Date(Date.now() + 5 * 60 * 1000), // Próxima sincronización en 5 min
        }, { status: 429 });
      }
    }

    logger.info('Iniciando sincronización de productos a Tiendanube', {
      storeId,
      userId: session.user.id,
      force,
    });

    // Obtener productos para sincronizar
    const conditions = [
      eq(tiendanubeProductMapping.storeId, storeId),
      // Saltar productos con demasiados fallos consecutivos (>5)
      sql`COALESCE(${tiendanubeProductMapping.consecutiveFailures}, 0) < 5`,
    ];

    // Si no es forzado, solo sincronizar productos actualizados recientemente
    if (!force && syncState?.lastSyncedAt) {
      conditions.push(
        gte(products.updated_at, new Date(syncState.lastSyncedAt))
      );
    }

    const mappingsToSync = await db
      .select({
        mapping: tiendanubeProductMapping,
        product: products,
        variant: productVariants,
      })
      .from(tiendanubeProductMapping)
      .leftJoin(products, eq(tiendanubeProductMapping.localProductId, products.id))
      .leftJoin(productVariants, eq(tiendanubeProductMapping.localVariantId, productVariants.id))
      .where(and(...conditions))
      .limit(SYNC_BATCH_SIZE);

    const result: SyncResult = {
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    // Sincronizar productos en batch con rate limiting
    for (const { mapping, product, variant } of mappingsToSync) {
      // Verificar tiempo límite
      if (Date.now() - startTime > MAX_SYNC_TIME_MS) {
        logger.warn('Sincronización detenida por tiempo límite', {
          storeId,
          processed: result.updated + result.failed,
          remaining: mappingsToSync.length - (result.updated + result.failed),
        });
        break;
      }

      if (!product) {
        result.skipped++;
        continue;
      }

      const syncResult = await syncProductToTiendanube(
        storeId,
        mapping,
        { ...product, variant: variant || undefined }
      );

      if (syncResult.success) {
        result.updated++;
      } else {
        result.failed++;
        result.errors.push({
          productId: mapping.localProductId,
          error: syncResult.error || 'Error desconocido',
        });
      }

      // Rate limiting entre llamadas
      await delay(SYNC_DELAY_MS);
    }

    // Actualizar estado de sincronización
    await db
      .insert(tiendanubeSyncState)
      .values({
        storeId,
        resource: 'products',
        cursor: null, // Podría usarse para paginación en el futuro
        lastSyncedAt: new Date(),
        lastError: result.failed > 0 ? `${result.failed} productos fallaron` : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [tiendanubeSyncState.storeId, tiendanubeSyncState.resource],
        set: {
          lastSyncedAt: new Date(),
          lastError: result.failed > 0 ? `${result.failed} productos fallaron` : null,
          updatedAt: new Date(),
        },
      });

    const duration = Date.now() - startTime;
    logger.info('Sincronización de productos completada', {
      storeId,
      result,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      success: true,
      result,
      duration: `${duration}ms`,
      nextSyncAt: new Date(Date.now() + 15 * 60 * 1000), // Próxima sincronización en 15 min
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error en sincronización de productos', {
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

// Endpoint para obtener estado de la sincronización
export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json({ error: 'storeId requerido' }, { status: 400 });
    }

    // Obtener estado de sincronización
    const syncState = await db.query.tiendanubeSyncState.findFirst({
      where: eq(tiendanubeSyncState.storeId, storeId),
    });

    // Obtener estadísticas de productos
    const stats = await db
      .select({
        total: sql<number>`count(*)`,
        synced: sql<number>`count(*) FILTER (WHERE sync_status = 'synced')`,
        pending: sql<number>`count(*) FILTER (WHERE sync_status = 'pending')`,
        error: sql<number>`count(*) FILTER (WHERE sync_status = 'error')`,
      })
      .from(tiendanubeProductMapping)
      .where(eq(tiendanubeProductMapping.storeId, storeId));

    return NextResponse.json({
      syncState,
      stats: stats[0],
    });
  } catch (error) {
    logger.error('Error obteniendo estado de sincronización', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error obteniendo estado' },
      { status: 500 }
    );
  }
}
