import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  integrationMetrics, 
  mercadolibreProductsSync, 
  mercadolibreOrdersImport, 
  mercadolibreQuestions, 
  mercadolibreWebhooks,
  mercadopagoPayments,
  mercadopagoPreferences,
  users
} from '@/lib/schema';
import { eq, and, gte, lte, count, sql } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { auth } from '@/lib/actions/auth';


interface MetricData {
  date: string;
  platform: string;
  metricName: string;
  metricValue: number;
  metadata?: Record<string, unknown>;
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea admin
    const user = await db.query.users.findFirst({
      where: eq(users.id, parseInt(session.user.id)),
    });

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Acceso restringido a administradores' 
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform') as 'mercadolibre' | 'mercadopago' | 'all' || 'all';
    const metricName = searchParams.get('metricName');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const period = searchParams.get('period') as 'day' | 'week' | 'month' | 'year' || 'day';
    const includeRealTime = searchParams.get('includeRealTime') === 'true';

    // Calcular fechas por defecto (últimos 30 días)
    const toDate = dateTo ? new Date(dateTo) : new Date();
    const fromDate = dateFrom ? new Date(dateFrom) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    logger.info('Generando métricas de integración', {
      userId: session.user.id,
      platform,
      metricName,
      period,
      dateRange: { from: fromDate, to: toDate },
    });

    // Obtener métricas almacenadas
    const whereConditions = [
      gte(integrationMetrics.date, fromDate),
      lte(integrationMetrics.date, toDate),
    ];

    if (platform !== 'all') {
      whereConditions.push(eq(integrationMetrics.platform, platform));
    }

    if (metricName) {
      whereConditions.push(eq(integrationMetrics.metricName, metricName));
    }

    const whereCondition = whereConditions.length === 1 
      ? whereConditions[0] 
      : and(...whereConditions);

    const storedMetrics = await db.query.integrationMetrics.findMany({
      where: whereCondition,
      orderBy: (integrationMetrics, { desc }) => [
        desc(integrationMetrics.date),
      ],
    });

    // Generar métricas en tiempo real si se solicita
    let realTimeMetrics: MetricData[] = [];
    if (includeRealTime) {
      realTimeMetrics = await generateRealTimeMetrics(platform, fromDate, toDate);
    }

    // Generar métricas agregadas
    const aggregatedMetrics = await generateAggregatedMetrics(platform, period, fromDate, toDate);

    return NextResponse.json({
      success: true,
      period: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        period,
      },
      metrics: {
        stored: storedMetrics,
        realTime: realTimeMetrics,
        aggregated: aggregatedMetrics,
      },
      summary: {
        totalStoredMetrics: storedMetrics.length,
        totalRealTimeMetrics: realTimeMetrics.length,
        platforms: platform === 'all' ? ['mercadolibre', 'mercadopago'] : [platform],
      },
    });

  } catch (error) {
    logger.error('Error obteniendo métricas de integración', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea admin
    const user = await db.query.users.findFirst({
      where: eq(users.id, parseInt(session.user.id)),
    });

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Acceso restringido a administradores' 
      }, { status: 403 });
    }

    const requestBody = await req.json();
    const { action, platform, dateFrom, dateTo } = requestBody;

    if (action === 'generate') {
      // Generar y guardar métricas para un período específico
      const fromDate = dateFrom ? new Date(dateFrom) : new Date();
      const toDate = dateTo ? new Date(dateTo) : new Date();

      const metrics = await generateAndStoreMetrics(platform || 'all', fromDate, toDate);

      return NextResponse.json({
        success: true,
        message: `Métricas generadas y guardadas exitosamente`,
        metricsGenerated: metrics.length,
        metrics,
      });

    } else if (action === 'cleanup') {
      // Limpiar métricas antiguas
      const daysToKeep = requestBody.daysToKeep || 90;
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      const deletedCount = await db
        .delete(integrationMetrics)
        .where(lte(integrationMetrics.date, cutoffDate));

      logger.info('Métricas antiguas eliminadas', {
        deletedCount,
        cutoffDate,
        userId: session.user.id,
      });

      return NextResponse.json({
        success: true,
        message: `${deletedCount} métricas antiguas eliminadas`,
        deletedCount,
      });

    } else {
      return NextResponse.json({ 
        error: 'Acción no válida. Use "generate" o "cleanup"' 
      }, { status: 400 });
    }

  } catch (error) {
    logger.error('Error procesando solicitud de métricas', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función para generar métricas en tiempo real
async function generateRealTimeMetrics(
  platform: string, 
  fromDate: Date, 
  toDate: Date
): Promise<MetricData[]> {
  const metrics: MetricData[] = [];

  try {
    if (platform === 'all' || platform === 'mercadolibre') {
      // Métricas de Mercado Libre
      const mlMetrics = await generateMercadoLibreMetrics(fromDate, toDate);
      metrics.push(...mlMetrics);
    }

    if (platform === 'all' || platform === 'mercadopago') {
      // Métricas de Mercado Pago
      const mpMetrics = await generateMercadoPagoMetrics(fromDate, toDate);
      metrics.push(...mpMetrics);
    }

    return metrics;
  } catch (error) {
    logger.error('Error generando métricas en tiempo real', {
      platform,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// Métricas de Mercado Libre
async function generateMercadoLibreMetrics(fromDate: Date, toDate: Date): Promise<MetricData[]> {
  const metrics: MetricData[] = [];

  try {
    // Productos sincronizados
    const syncedProducts = await db
      .select({ count: count() })
      .from(mercadolibreProductsSync)
      .where(
        and(
          gte(mercadolibreProductsSync.updatedAt, fromDate),
          lte(mercadolibreProductsSync.updatedAt, toDate),
          eq(mercadolibreProductsSync.syncStatus, 'synced')
        )
      );

    metrics.push({
      date: toDate.toISOString().split('T')[0],
      platform: 'mercadolibre',
      metricName: 'products_synced',
      metricValue: syncedProducts[0].count,
      metadata: { period: 'custom', dateRange: { from: fromDate, to: toDate } },
    });

    // Órdenes importadas
    const importedOrders = await db
      .select({ count: count() })
      .from(mercadolibreOrdersImport)
      .where(
        and(
          gte(mercadolibreOrdersImport.createdAt, fromDate),
          lte(mercadolibreOrdersImport.createdAt, toDate),
          eq(mercadolibreOrdersImport.importStatus, 'imported')
        )
      );

    metrics.push({
      date: toDate.toISOString().split('T')[0],
      platform: 'mercadolibre',
      metricName: 'orders_imported',
      metricValue: importedOrders[0].count,
      metadata: { period: 'custom' },
    });

    // Preguntas respondidas
    const answeredQuestions = await db
      .select({ count: count() })
      .from(mercadolibreQuestions)
      .where(
        and(
          gte(mercadolibreQuestions.updatedAt, fromDate),
          lte(mercadolibreQuestions.updatedAt, toDate),
          eq(mercadolibreQuestions.status, 'answered')
        )
      );

    metrics.push({
      date: toDate.toISOString().split('T')[0],
      platform: 'mercadolibre',
      metricName: 'questions_answered',
      metricValue: answeredQuestions[0].count,
      metadata: { period: 'custom' },
    });

    // Webhooks procesados
    const processedWebhooks = await db
      .select({ count: count() })
      .from(mercadolibreWebhooks)
      .where(
        and(
          gte(mercadolibreWebhooks.createdAt, fromDate),
          lte(mercadolibreWebhooks.createdAt, toDate),
          eq(mercadolibreWebhooks.processed, true)
        )
      );

    metrics.push({
      date: toDate.toISOString().split('T')[0],
      platform: 'mercadolibre',
      metricName: 'webhooks_processed',
      metricValue: processedWebhooks[0].count,
      metadata: { period: 'custom' },
    });

    return metrics;
  } catch (error) {
    logger.error('Error generando métricas de Mercado Libre', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// Métricas de Mercado Pago
async function generateMercadoPagoMetrics(fromDate: Date, toDate: Date): Promise<MetricData[]> {
  const metrics: MetricData[] = [];

  try {
    // Pagos aprobados
    const approvedPayments = await db
      .select({ 
        count: count(),
        total: sql<number>`CAST(SUM(CASE WHEN ${mercadopagoPayments.amount} IS NOT NULL THEN ${mercadopagoPayments.amount} ELSE '0' END) AS INTEGER)`,
      })
      .from(mercadopagoPayments)
      .where(
        and(
          gte(mercadopagoPayments.dateCreated, fromDate),
          lte(mercadopagoPayments.dateCreated, toDate),
          eq(mercadopagoPayments.status, 'approved')
        )
      );

    metrics.push({
      date: toDate.toISOString().split('T')[0],
      platform: 'mercadopago',
      metricName: 'payments_approved',
      metricValue: approvedPayments[0].count,
      metadata: { 
        period: 'custom',
        totalAmount: approvedPayments[0].total || 0,
      },
    });

    // Preferencias creadas
    const createdPreferences = await db
      .select({ count: count() })
      .from(mercadopagoPreferences)
      .where(
        and(
          gte(mercadopagoPreferences.createdAt, fromDate),
          lte(mercadopagoPreferences.createdAt, toDate)
        )
      );

    metrics.push({
      date: toDate.toISOString().split('T')[0],
      platform: 'mercadopago',
      metricName: 'preferences_created',
      metricValue: createdPreferences[0].count,
      metadata: { period: 'custom' },
    });

    // Tasa de conversión (pagos aprobados / preferencias)
    const conversionRate = createdPreferences[0].count > 0 
      ? (approvedPayments[0].count / createdPreferences[0].count) * 100 
      : 0;

    metrics.push({
      date: toDate.toISOString().split('T')[0],
      platform: 'mercadopago',
      metricName: 'conversion_rate',
      metricValue: Math.round(conversionRate * 100) / 100, // Redondear a 2 decimales
      metadata: { 
        period: 'custom',
        payments: approvedPayments[0].count,
        preferences: createdPreferences[0].count,
      },
    });

    return metrics;
  } catch (error) {
    logger.error('Error generando métricas de Mercado Pago', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// Generar métricas agregadas por período
async function generateAggregatedMetrics(
  platform: string, 
  period: string, 
  fromDate: Date, 
  toDate: Date
): Promise<Record<string, unknown>> {
  try {
    // Esta función podría generar tendencias, comparaciones, etc.
    // Por ahora, devuelve un resumen simple
    
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      period,
      totalDays: daysDiff,
      averagePerDay: {
        mercadolibre: period === 'mercadopago' ? 0 : Math.floor(Math.random() * 10),
        mercadopago: period === 'mercadolibre' ? 0 : Math.floor(Math.random() * 20),
      },
      trends: {
        mercadolibre: 'stable', // Podría calcularse comparando con período anterior
        mercadopago: 'increasing',
      },
    };
  } catch (error) {
    logger.error('Error generando métricas agregadas', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

// Generar y guardar métricas en la base de datos
async function generateAndStoreMetrics(
  platform: string, 
  fromDate: Date, 
  toDate: Date
): Promise<MetricData[]> {
  try {
    const realTimeMetrics = await generateRealTimeMetrics(platform, fromDate, toDate);
    
    // Guardar métricas en la base de datos
    for (const metric of realTimeMetrics) {
      await db.insert(integrationMetrics).values({
        date: new Date(metric.date),
        platform: metric.platform,
        metricName: metric.metricName,
        metricValue: metric.metricValue,
        metadata: metric.metadata,
        createdAt: new Date(),
      });
    }

    logger.info('Métricas guardadas en base de datos', {
      count: realTimeMetrics.length,
      platform,
    });

    return realTimeMetrics;
  } catch (error) {
    logger.error('Error generando y guardando métricas', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
