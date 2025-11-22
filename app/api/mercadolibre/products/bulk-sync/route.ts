import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, mercadolibreProductsSync } from '@/lib/schema';
import { eq, and, isNull, or, sql, count } from 'drizzle-orm';
import { makeAuthenticatedRequest, isConnected } from '@/lib/auth/mercadolibre';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { logger } from '@/lib/utils/logger';
import { auth } from '@/lib/actions/auth';

interface BulkSyncRequest {
  productIds?: number[];
  syncAll?: boolean;
  batchSize?: number;
}

interface SyncResult {
  productId: number;
  mlItemId?: string;
  status: 'success' | 'error';
  error?: string;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const syncResults: SyncResult[] = [];
  
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body: BulkSyncRequest = await req.json();
    const { productIds, syncAll = false, batchSize = 10 } = body;

    if (!productIds && !syncAll) {
      return NextResponse.json({ 
        error: 'Debe proporcionar productIds o syncAll=true' 
      }, { status: 400 });
    }

    // Verificar conexión con Mercado Libre
    const connected = await isConnected(parseInt(session.user.id));
    if (!connected) {
      return NextResponse.json({ 
        error: 'Usuario no conectado a Mercado Libre' 
      }, { status: 400 });
    }

    // Determinar qué productos sincronizar
    let productsToSync;
    
    if (syncAll) {
      // Obtener productos que no están sincronizados o tienen errores
      productsToSync = await db.query.products.findMany({
        where: or(
          isNull(products.mlItemId),
          eq(products.mlSyncStatus, 'error'),
          eq(products.mlSyncStatus, 'pending')
        ),
        limit: batchSize,
      });
    } else if (productIds) {
      // Sincronizar productos específicos
      productsToSync = await db.query.products.findMany({
        where: eq(products.id, productIds[0]), // Simplificado para batch
      });
    } else {
      return NextResponse.json({ 
        error: 'No se encontraron productos para sincronizar' 
      }, { status: 400 });
    }

    if (productsToSync.length === 0) {
      return NextResponse.json({ 
        message: 'No hay productos pendientes de sincronización',
        results: []
      });
    }

    logger.info('Iniciando sincronización masiva', {
      userId: session.user.id,
      productCount: productsToSync.length,
      syncAll,
    });

    // Procesar cada producto
    for (const product of productsToSync) {
      const result: SyncResult = {
        productId: product.id,
        status: 'error',
      };

      try {
        // Verificar si ya está en proceso
        const existingSync = await db.query.mercadolibreProductsSync.findFirst({
          where: and(
            eq(mercadolibreProductsSync.productId, product.id),
            eq(mercadolibreProductsSync.syncStatus, 'syncing')
          ),
        });

        if (existingSync) {
          result.status = 'error';
          result.error = 'Producto ya está siendo sincronizado';
          syncResults.push(result);
          continue;
        }

        // Crear registro de sincronización
        const syncRecord = await db.insert(mercadolibreProductsSync).values({
          productId: product.id,
          syncStatus: 'syncing',
          lastSyncAt: new Date(),
          syncAttempts: 1,
        }).onConflictDoUpdate({
          target: mercadolibreProductsSync.productId,
          set: {
            syncStatus: 'syncing',
            lastSyncAt: new Date(),
            syncAttempts: sql`${mercadolibreProductsSync.syncAttempts} + 1`,
          },
        }).returning();

        // Preparar datos para Mercado Libre
        const mlProductData = {
          title: product.name,
          category_id: product.mlCategoryId || 'MLA3530',
          price: parseFloat(product.price),
          currency_id: product.mlCurrencyId || 'ARS',
          available_quantity: product.stock,
          buying_mode: product.mlBuyingMode || 'buy_it_now',
          condition: product.mlCondition || 'new',
          listing_type_id: product.mlListingTypeId || 'bronze',
          description: product.description || '',
          pictures: product.image ? [{
            source: product.image,
          }] : [],
          attributes: product.attributes || [],
        };

        // Enviar a Mercado Libre
        const response = await makeAuthenticatedRequest(
          parseInt(session.user.id),
          '/items',
          {
            method: 'POST',
            body: JSON.stringify(mlProductData),
          }
        );

        if (!response.ok) {
          const errorData = await response.text();
          throw new MercadoLibreError(
            MercadoLibreErrorCode.INVALID_REQUEST,
            `Error creando producto en ML: ${errorData}`,
            { status: response.status, error: errorData }
          );
        }

        const mlItem = await response.json();
        const mlItemId = mlItem.id;

        // Actualizar producto local
        await db.update(products)
          .set({
            mlItemId,
            mlSyncStatus: 'synced',
            mlLastSync: new Date(),
            mlPermalink: mlItem.permalink,
            mlThumbnail: mlItem.thumbnail,
            updated_at: new Date(),
          })
          .where(eq(products.id, product.id));

        // Actualizar registro de sincronización
        await db.update(mercadolibreProductsSync)
          .set({
            mlItemId,
            syncStatus: 'synced',
            lastSyncAt: new Date(),
            mlData: mlItem,
            updatedAt: new Date(),
          })
          .where(eq(mercadolibreProductsSync.id, syncRecord[0].id));

        result.status = 'success';
        result.mlItemId = mlItemId;

        logger.info('Producto sincronizado exitosamente (batch)', {
          productId: product.id,
          mlItemId,
        });

      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        
        // Actualizar estado a error
        try {
          await db.update(mercadolibreProductsSync)
            .set({
              syncStatus: 'error',
              syncError: result.error,
              updatedAt: new Date(),
            })
            .where(eq(mercadolibreProductsSync.productId, product.id));

          await db.update(products)
            .set({
              mlSyncStatus: 'error',
              updated_at: new Date(),
            })
            .where(eq(products.id, product.id));
        } catch (updateError) {
          logger.error('Error actualizando estado de error', { 
            productId: product.id,
            updateError 
          });
        }

        logger.error('Error sincronizando producto (batch)', {
          productId: product.id,
          error: result.error,
        });
      }

      syncResults.push(result);

      // Pequeña pausa entre requests para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const successCount = syncResults.filter(r => r.status === 'success').length;
    const errorCount = syncResults.filter(r => r.status === 'error').length;

    logger.info('Sincronización masiva completada', {
      userId: session.user.id,
      totalProducts: productsToSync.length,
      successCount,
      errorCount,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      success: true,
      summary: {
        total: productsToSync.length,
        successful: successCount,
        failed: errorCount,
        duration: `${duration}ms`,
      },
      results: syncResults,
    });

  } catch (error) {
    logger.error('Error en sincronización masiva', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Obtener registros de sincronización con filtros
    const whereCondition = status ? eq(mercadolibreProductsSync.syncStatus, status as 'pending' | 'error' | 'syncing' | 'synced' | 'conflict') : undefined;

    const syncRecords = await db.query.mercadolibreProductsSync.findMany({
      where: whereCondition,
      with: {
        product: true,
      },
      limit,
      offset,
      orderBy: (mercadolibreProductsSync, { desc }) => [
        desc(mercadolibreProductsSync.updatedAt),
      ],
    });

    // Obtener estadísticas
    const stats = await db
      .select({
        status: mercadolibreProductsSync.syncStatus,
        count: count(mercadolibreProductsSync.id),
      })
      .from(mercadolibreProductsSync)
      .groupBy(mercadolibreProductsSync.syncStatus);

    return NextResponse.json({
      records: syncRecords,
      stats,
      pagination: {
        limit,
        offset,
        total: syncRecords.length,
      },
    });

  } catch (error) {
    logger.error('Error obteniendo registros de sincronización masiva', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
