import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, mercadolibreProductsSync } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { makeAuthenticatedRequest, isConnected } from '@/lib/auth/mercadolibre';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { logger } from '@/lib/utils/logger';
import { auth } from '@/lib/actions/auth';

export async function POST(req: Request) {
  let productId: number | null = null;
  let productIdNum: number | null = null;
  
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const requestData = await req.json();
    productId = requestData.productId;
    
    if (!productId) {
      return NextResponse.json({ error: 'productId es requerido' }, { status: 400 });
    }

    productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;

    // Verificar conexión con Mercado Libre
    const connected = await isConnected(parseInt(session.user.id));
    if (!connected) {
      return NextResponse.json({ 
        error: 'Usuario no conectado a Mercado Libre' 
      }, { status: 400 });
    }

    // Obtener producto local
    const localProduct = await db.query.products.findFirst({
      where: eq(products.id, productIdNum!),
    });

    if (!localProduct) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Verificar si ya existe una sincronización en curso
    const existingSync = await db.query.mercadolibreProductsSync.findFirst({
      where: and(
        eq(mercadolibreProductsSync.productId, productIdNum!),
        eq(mercadolibreProductsSync.syncStatus, 'syncing')
      ),
    });

    if (existingSync) {
      return NextResponse.json({ 
        error: 'El producto ya está siendo sincronizado' 
      }, { status: 409 });
    }

    // Crear o actualizar registro de sincronización
    const syncRecord = await db.insert(mercadolibreProductsSync).values({
      productId: productIdNum!,
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
      title: localProduct.name,
      category_id: localProduct.mlCategoryId || 'MLA3530', // Categoría por defecto
      price: parseFloat(localProduct.price),
      currency_id: localProduct.mlCurrencyId || 'ARS',
      available_quantity: localProduct.stock,
      buying_mode: localProduct.mlBuyingMode || 'buy_it_now',
      condition: localProduct.mlCondition || 'new',
      listing_type_id: localProduct.mlListingTypeId || 'bronze',
      description: localProduct.description || '',
      pictures: localProduct.image ? [{
        source: localProduct.image,
      }] : [],
      attributes: localProduct.attributes || [],
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

    // Actualizar producto local con ID de ML
    await db.update(products)
      .set({
        mlItemId,
        mlSyncStatus: 'synced',
        mlLastSync: new Date(),
        mlPermalink: mlItem.permalink,
        mlThumbnail: mlItem.thumbnail,
        updated_at: new Date(),
      })
      .where(eq(products.id, productIdNum!));

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

    logger.info('Producto sincronizado exitosamente', {
      productId: productIdNum!,
      mlItemId,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      productId: productIdNum!,
      mlItemId,
      mlPermalink: mlItem.permalink,
      syncStatus: 'synced',
    });

  } catch (error) {
    logger.error('Error sincronizando producto', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Actualizar estado de sincronización a error
    if (productId && productIdNum) {
      try {
        await db.update(mercadolibreProductsSync)
          .set({
            syncStatus: 'error',
            syncError: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(mercadolibreProductsSync.productId, productIdNum!));

        await db.update(products)
          .set({
            mlSyncStatus: 'error',
            updated_at: new Date(),
          })
          .where(eq(products.id, productIdNum!));
      } catch (updateError) {
        logger.error('Error actualizando estado de sincronización', { updateError });
      }
    }

    if (error instanceof MercadoLibreError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
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
    const productId = searchParams.get('productId');

    if (productId) {
      // Obtener estado de sincronización de un producto específico
      const syncRecord = await db.query.mercadolibreProductsSync.findFirst({
        where: eq(mercadolibreProductsSync.productId, parseInt(productId)),
        with: {
          product: true,
        },
      });

      if (!syncRecord) {
        return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
      }

      return NextResponse.json(syncRecord);
    } else {
      // Obtener todos los registros de sincronización del usuario
      const syncRecords = await db.query.mercadolibreProductsSync.findMany({
        with: {
          product: true,
        },
      });

      return NextResponse.json(syncRecords);
    }

  } catch (error) {
    logger.error('Error obteniendo estado de sincronización', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
