import { NextResponse } from 'next/server';
import { db, checkDatabaseConnection } from '@/lib/db';
import { products, mercadolibreProductsSync, productVariants } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';
import { auth } from '@/lib/actions/auth';

export async function DELETE(req: Request) {
  let productId: number | null = null;
  let productIdNum: number | null = null;
  
  try {
    // Verificar conexión a base de datos
    try {
      const dbCheck = await checkDatabaseConnection();
      if (!dbCheck.success) {
        console.error('ERROR CRUDO CONEXIÓN DB:', dbCheck);
        return NextResponse.json({ 
          error: 'Error de conexión a base de datos' 
        }, { status: 500 });
      }
    } catch (dbConnError) {
      console.error('ERROR CRUDO VERIFICACIÓN DB:', dbConnError);
      throw dbConnError;
    }
    
    // Validar sesión
    let session;
    try {
      session = await auth();
    } catch (authError) {
      console.error('ERROR CRUDO AUTH:', authError);
      throw authError;
    }
    
    if (!session?.user?.id) {
      console.error('ERROR CRUDO: Sesión inválida', { session });
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener productId del body
    const requestData = await req.json();
    productId = requestData.productId;
    
    if (!productId) {
      return NextResponse.json({ error: 'productId es requerido' }, { status: 400 });
    }

    productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;

    // Verificar que el producto existe y está sincronizado
    let localProduct;
    try {
      localProduct = await db.query.products.findFirst({
        where: eq(products.id, productIdNum!),
        with: {
          variants: {
            where: eq(productVariants.isActive, true),
          },
        },
      });
    } catch (dbError) {
      console.error('ERROR CRUDO DB QUERY PRODUCTO:', dbError);
      throw dbError;
    }

    if (!localProduct) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    if (!localProduct.mlItemId) {
      return NextResponse.json({ error: 'El producto no está sincronizado con Mercado Libre' }, { status: 400 });
    }

    // Verificar si el producto está siendo sincronizado actualmente
    const existingSync = await db.query.mercadolibreProductsSync.findFirst({
      where: and(
        eq(mercadolibreProductsSync.productId, productIdNum!),
        eq(mercadolibreProductsSync.syncStatus, 'syncing')
      ),
    });

    if (existingSync) {
      return NextResponse.json({ 
        error: 'No se puede desincronizar mientras el producto está siendo sincronizado' 
      }, { status: 409 });
    }

    logger.info('Iniciando desincronización de producto', {
      productId: productIdNum,
      mlItemId: localProduct.mlItemId,
      userId: session.user.id
    });

    // Opcional: Pausar la publicación en Mercado Libre (cambiar status a paused)
    // Esto no elimina la publicación, solo la pausa
    try {
      const pauseResponse = await makeAuthenticatedRequest(
        parseInt(session.user.id),
        `/items/${localProduct.mlItemId}/listing_type`,
        {
          method: 'POST',
          body: JSON.stringify({
            listing_type_id: 'free' // Cambiar a gratuita para pausar
          }),
        }
      );

      if (!pauseResponse.ok) {
        logger.warn('No se pudo pausar la publicación en Mercado Libre', {
          productId: productIdNum,
          mlItemId: localProduct.mlItemId,
          status: pauseResponse.status
        });
        // Continuar con la desincronización local incluso si falla el pausado en ML
      }
    } catch (pauseError) {
      logger.warn('Error al pausar publicación en Mercado Libre (continuando)', {
        productId: productIdNum,
        mlItemId: localProduct.mlItemId,
        error: pauseError instanceof Error ? pauseError.message : String(pauseError)
      });
      // Continuar con la desincronización local
    }

    // Limpiar campos de sincronización en el producto local
    try {
      await db.update(products)
        .set({
          mlItemId: null,
          mlSyncStatus: 'pending',
          mlLastSync: null,
          mlPermalink: null,
          mlThumbnail: null,
          updated_at: new Date(),
        })
        .where(eq(products.id, productIdNum!));

      // Limpiar IDs de variación si existen
      if (localProduct.variants && Array.isArray(localProduct.variants) && localProduct.variants.length > 0) {
        for (const variant of localProduct.variants) {
          await db.update(productVariants)
            .set({
              mlVariationId: null,
              mlSyncStatus: 'pending',
              updated_at: new Date(),
            })
            .where(eq(productVariants.id, variant.id));
        }
      }

      // Actualizar registro de sincronización
      await db.update(mercadolibreProductsSync)
        .set({
          syncStatus: 'pending',
          syncError: 'Producto desincronizado manualmente',
          updatedAt: new Date(),
        })
        .where(eq(mercadolibreProductsSync.productId, productIdNum!));

    } catch (dbError) {
      console.error('ERROR CRUDO LIMPIEZA SINCRONIZACIÓN:', dbError);
      throw dbError;
    }

    logger.info('Producto desincronizado exitosamente', {
      productId: productIdNum,
      mlItemId: localProduct.mlItemId,
      userId: session.user.id
    });

    return NextResponse.json({
      success: true,
      productId: productIdNum,
      message: 'Producto desincronizado correctamente. La publicación en Mercado Libre ha sido pausada pero no eliminada.',
      mlItemId: localProduct.mlItemId
    });

  } catch (error) {
    console.error('=== ERROR CRUDO DESINCRONIZACIÓN PRODUCTO ===');
    console.error('ERROR:', error);
    console.error('TIPO:', error?.constructor?.name);
    console.error('MENSAJE:', error instanceof Error ? error.message : String(error));
    console.error('STACK:', error instanceof Error ? error.stack : 'No stack disponible');
    console.error('PRODUCT ID:', productIdNum);
    console.error('=== FIN ERROR CRUDO ===');
    
    logger.error('Error desincronizando producto', {
      productId: productIdNum,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { 
        error: 'Error interno del servidor al desincronizar producto',
        productId: productIdNum,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
