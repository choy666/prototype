import { NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { mercadolibreProductsSync, products } from '@/lib/schema';
import { count, desc, eq } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { validateProductForMLSync } from '@/lib/validations/ml-sync-validation';

// Devuelve un resumen global del estado de sincronización con Mercado Libre
// Utilizado por el componente MercadoLibreStatus en el panel de admin
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener estadísticas por estado desde la tabla mercadolibre_products_sync
    const stats = await db
      .select({
        status: mercadolibreProductsSync.syncStatus,
        count: count(mercadolibreProductsSync.id),
      })
      .from(mercadolibreProductsSync)
      .groupBy(mercadolibreProductsSync.syncStatus);

    // Calcular agregados para el dashboard
    const total = stats.reduce((sum, s) => sum + Number(s.count), 0);

    const synced = stats
      .filter((s) => s.status === 'synced')
      .reduce((sum, s) => sum + Number(s.count), 0);

    // Consideramos pending + syncing como "pendientes" para el resumen
    const pending = stats
      .filter((s) => s.status === 'pending' || s.status === 'syncing')
      .reduce((sum, s) => sum + Number(s.count), 0);

    // Consideramos error y conflict como "errores"
    const errors = stats
      .filter((s) => s.status === 'error' || s.status === 'conflict')
      .reduce((sum, s) => sum + Number(s.count), 0);

    const recentItems = await db
      .select({
        sync: mercadolibreProductsSync,
        product: products,
      })
      .from(mercadolibreProductsSync)
      .leftJoin(
        products,
        eq(mercadolibreProductsSync.productId, products.id),
      )
      .orderBy(desc(mercadolibreProductsSync.updatedAt))
      .limit(15);

    const userId = parseInt(session.user.id);

    const items = await Promise.all(
      recentItems.map(async ({ sync, product }) => {
        if (!product) {
          return {
            id: sync.id,
            productId: sync.productId,
            productName: 'Producto no encontrado',
            syncStatus: sync.syncStatus,
            mlItemId: sync.mlItemId,
            lastSyncAt: sync.lastSyncAt,
            updatedAt: sync.updatedAt,
            syncError: sync.syncError,
            syncAttempts: sync.syncAttempts,
            validation: null,
          };
        }

        const validation = await validateProductForMLSync(
          product,
          undefined,
          userId,
        );

        return {
          id: sync.id,
          productId: sync.productId,
          productName: product.name,
          syncStatus: sync.syncStatus,
          mlItemId: sync.mlItemId,
          lastSyncAt: sync.lastSyncAt,
          updatedAt: sync.updatedAt,
          syncError: sync.syncError,
          syncAttempts: sync.syncAttempts,
          stock: product.stock,
          me2Compatible: product.me2Compatible,
          mlCategoryId: product.mlCategoryId,
          validation: {
            isValid: validation.isValid,
            errors: validation.errors,
            warnings: validation.warnings,
            missingRequired: validation.missingRequired.map(
              (attr) => attr.name || attr.id,
            ),
            missingConditional: validation.missingConditional.map(
              (attr) => attr.name || attr.id,
            ),
          },
        };
      }),
    );

    return NextResponse.json({
      total,
      synced,
      pending,
      errors,
      items,
    });
  } catch (error) {
    logger.error('Error obteniendo estado de sincronización de Mercado Libre', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

