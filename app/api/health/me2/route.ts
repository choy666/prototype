import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, categories } from '@/lib/schema';
import { logger } from '@/lib/utils/logger';
import { getME2CacheStats, clearME2Cache } from '@/lib/mercado-envios/me2Api';
import { getDimensionsCacheStats, clearDimensionsCache } from '@/lib/mercado-envios/me2Dimensions';
import { sql } from 'drizzle-orm';

export async function GET() {
  const requestId = crypto.randomUUID();
  
  try {
    logger.info('[Health] ME2: Iniciando health check', { requestId });

    // Validar variables de entorno críticas
    const envChecks = {
      mercadopagoAccessToken: !!process.env.MERCADO_PAGO_ACCESS_TOKEN,
      mercadopagoWebhookSecret: !!process.env.MERCADO_PAGO_WEBHOOK_SECRET,
      databaseUrl: !!process.env.DATABASE_URL,
    };

    const envValid = Object.values(envChecks).every(check => check);

    // Validar conexión a base de datos
    let dbValid = false;
    let dbStats = null;
    
    if (envValid) {
      try {
        // Consultas separadas para obtener estadísticas correctas
        const [totalProductsResult, me2ProductsResult, totalCategoriesResult, me2CategoriesResult] = await Promise.all([
          db.select({ count: sql<number>`count(*)::int` }).from(products),
          db.select({ count: sql<number>`count(*)::int` }).from(products).where(sql`${products.me2Compatible} = true`),
          db.select({ count: sql<number>`count(*)::int` }).from(categories),
          db.select({ count: sql<number>`count(*)::int` }).from(categories).where(sql`${categories.me2Compatible} = true`),
        ]);

        dbStats = {
          totalProducts: totalProductsResult[0]?.count || 0,
          me2CompatibleProducts: me2ProductsResult[0]?.count || 0,
          totalCategories: totalCategoriesResult[0]?.count || 0,
          me2CompatibleCategories: me2CategoriesResult[0]?.count || 0,
        };

        dbValid = true;
        logger.info('[Health] ME2: Estadísticas de BD obtenidas', {
          requestId,
          stats: dbStats
        });
        
      } catch (dbError) {
        logger.error('[Health] ME2: Error en conexión a BD', {
          requestId,
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    }

    // Validar estado de caches
    const me2CacheStats = getME2CacheStats();
    const dimensionsCacheStats = getDimensionsCacheStats();

    // Calcular health score
    const checks = {
      environment: envValid,
      database: dbValid,
      me2Cache: me2CacheStats.cacheSize >= 0,
      dimensionsCache: dimensionsCacheStats.size >= 0,
    };

    const allChecksPass = Object.values(checks).every(check => check);
    const healthScore = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;

    const healthData = {
      status: allChecksPass ? 'healthy' : 'unhealthy',
      score: Math.round(healthScore * 100),
      timestamp: new Date().toISOString(),
      requestId,
      checks,
      environment: envChecks,
      database: dbValid ? {
        connected: true,
        stats: dbStats || {
          totalProducts: 0,
          me2CompatibleProducts: 0,
          totalCategories: 0,
          me2CompatibleCategories: 0,
        }
      } : {
        connected: false,
        error: 'Database connection failed'
      },
      caches: {
        me2: me2CacheStats,
        dimensions: dimensionsCacheStats,
      },
      version: '1.0.0',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      }
    };

    logger.info('[Health] ME2: Health check completado', {
      requestId,
      status: healthData.status,
      score: healthData.score,
      checks
    });

    return NextResponse.json(healthData, {
      status: allChecksPass ? 200 : 503
    });

  } catch (error) {
    logger.error('[Health] ME2: Error en health check', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST() {
  const requestId = crypto.randomUUID();
  
  try {
    logger.info('[Health] ME2: Limpiando caches', { requestId });

    // Limpiar todos los caches
    clearME2Cache();
    clearDimensionsCache();

    logger.info('[Health] ME2: Caches limpiados exitosamente', { requestId });

    return NextResponse.json({
      success: true,
      message: 'All ME2 caches cleared successfully',
      timestamp: new Date().toISOString(),
      requestId
    });

  } catch (error) {
    logger.error('[Health] ME2: Error limpiando caches', {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      requestId
    }, { status: 500 });
  }
}
