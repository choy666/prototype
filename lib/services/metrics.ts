import { db } from '@/lib/db';
import { integrationMetrics, products } from '@/lib/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export async function recordIntegrationMetric(
  platform: 'mercadolibre' | 'mercadopago',
  metricName: string,
  value: number,
  metadata?: Record<string, unknown>
) {
  await db.insert(integrationMetrics).values({
    date: new Date(),
    platform,
    metricName,
    metricValue: value,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

export async function getIntegrationMetrics(
  platform: 'mercadolibre' | 'mercadopago',
  metricName: string,
  startDate: Date,
  endDate: Date
) {
  return await db.query.integrationMetrics.findMany({
    where: and(
      eq(integrationMetrics.platform, platform),
      eq(integrationMetrics.metricName, metricName),
      gte(integrationMetrics.date, startDate),
      lte(integrationMetrics.date, endDate)
    ),
    orderBy: [desc(integrationMetrics.date)],
  });
}

export async function getDailyMetricsSummary(date: Date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const metrics = await db.query.integrationMetrics.findMany({
    where: and(
      gte(integrationMetrics.date, startOfDay),
      lte(integrationMetrics.date, endOfDay)
    ),
  });

  // Agrupar por plataforma y métrica
  const summary: Record<string, Record<string, number>> = {};
  
  for (const metric of metrics) {
    if (!summary[metric.platform]) {
      summary[metric.platform] = {};
    }
    
    if (!summary[metric.platform][metric.metricName]) {
      summary[metric.platform][metric.metricName] = 0;
    }
    
    summary[metric.platform][metric.metricName] += metric.metricValue;
  }

  return summary;
}

// Métricas específicas para Mercado Libre
export async function recordMercadoLibreMetrics(userId: number) {
  try {
    // Contar productos sincronizados
    const syncedProducts = await db.query.products.findMany({
      where: eq(products.mlSyncStatus, 'synced'),
    });

    // Contar productos pendientes
    const pendingProducts = await db.query.products.findMany({
      where: eq(products.mlSyncStatus, 'pending'),
    });

    // Contar productos con errores
    const errorProducts = await db.query.products.findMany({
      where: eq(products.mlSyncStatus, 'error'),
    });
    
    await Promise.all([
      recordIntegrationMetric('mercadolibre', 'products_synced', syncedProducts.length, { userId }),
      recordIntegrationMetric('mercadolibre', 'products_pending', pendingProducts.length, { userId }),
      recordIntegrationMetric('mercadolibre', 'products_error', errorProducts.length, { userId }),
    ]);

  } catch (error) {
    console.error('Error registrando métricas ML:', error);
  }
}

// Métricas específicas para Mercado Pago
export async function recordMercadoPagoMetrics(userId: number) {
  try {
    // Aquí se pueden agregar métricas específicas de Mercado Pago
    // Por ejemplo: pagos procesados, preferencias creadas, etc.
    
    // Ejemplo de métricas de Mercado Pago
    await Promise.all([
      recordIntegrationMetric('mercadopago', 'daily_check', 1, { userId }),
    ]);

  } catch (error) {
    console.error('Error registrando métricas MP:', error);
  }
}

// Obtener métricas de un rango de fechas
export async function getMetricsByDateRange(
  platform: 'mercadolibre' | 'mercadopago',
  startDate: Date,
  endDate: Date
) {
  return await db.query.integrationMetrics.findMany({
    where: and(
      eq(integrationMetrics.platform, platform),
      gte(integrationMetrics.date, startDate),
      lte(integrationMetrics.date, endDate)
    ),
    orderBy: [desc(integrationMetrics.date)],
  });
}

// Obtener resumen de métricas por plataforma
export async function getPlatformMetricsSummary(
  platform: 'mercadolibre' | 'mercadopago',
  days: number = 7
) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const metrics = await getMetricsByDateRange(platform, startDate, endDate);
  
  const summary: Record<string, number> = {};
  
  for (const metric of metrics) {
    if (!summary[metric.metricName]) {
      summary[metric.metricName] = 0;
    }
    summary[metric.metricName] += metric.metricValue;
  }

  return summary;
}
