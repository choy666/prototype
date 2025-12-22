import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { 
  tiendanubeStores, 
  tiendanubeWebhooksRaw,
  tiendanubeProductMapping,
  tiendanubeSyncState,
  tiendanubeCustomerMapping,
  orders,
} from '@/lib/schema';
import { eq, and, gte, sql, desc, lte } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

export const runtime = 'nodejs';

interface WebhookMetrics {
  total: number;
  pending: number;
  retrying: number;
  processed: number;
  deadLetter: number;
  last24h: number;
  lastHour: number;
}

interface SyncMetrics {
  totalProducts: number;
  synced: number;
  pending: number;
  error: number;
  lastSyncAt: Date | null;
  consecutiveFailures: number;
}

interface OrderMetrics {
  totalOrders: number;
  last24h: number;
  lastWeek: number;
  pendingOrders: number;
  totalCustomers: number;
}

interface DashboardMetrics {
  store: {
    storeId: string;
    status: string;
    connectedAt: Date | null;
  };
  webhooks: WebhookMetrics;
  sync: SyncMetrics;
  orders: OrderMetrics;
}

async function getWebhookMetrics(storeId: string): Promise<WebhookMetrics> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

  const [total, pending, retrying, processed, deadLetter, last24hCount, lastHourCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(tiendanubeWebhooksRaw)
      .where(eq(tiendanubeWebhooksRaw.storeId, storeId))
      .then(r => r[0].count),
    
    db.select({ count: sql<number>`count(*)` })
      .from(tiendanubeWebhooksRaw)
      .where(and(eq(tiendanubeWebhooksRaw.storeId, storeId), eq(tiendanubeWebhooksRaw.status, 'pending')))
      .then(r => r[0].count),
    
    db.select({ count: sql<number>`count(*)` })
      .from(tiendanubeWebhooksRaw)
      .where(and(eq(tiendanubeWebhooksRaw.storeId, storeId), eq(tiendanubeWebhooksRaw.status, 'retrying')))
      .then(r => r[0].count),
    
    db.select({ count: sql<number>`count(*)` })
      .from(tiendanubeWebhooksRaw)
      .where(and(eq(tiendanubeWebhooksRaw.storeId, storeId), eq(tiendanubeWebhooksRaw.processed, true)))
      .then(r => r[0].count),
    
    db.select({ count: sql<number>`count(*)` })
      .from(tiendanubeWebhooksRaw)
      .where(and(eq(tiendanubeWebhooksRaw.storeId, storeId), eq(tiendanubeWebhooksRaw.status, 'dead_letter')))
      .then(r => r[0].count),
    
    db.select({ count: sql<number>`count(*)` })
      .from(tiendanubeWebhooksRaw)
      .where(and(eq(tiendanubeWebhooksRaw.storeId, storeId), gte(tiendanubeWebhooksRaw.createdAt, last24h)))
      .then(r => r[0].count),
    
    db.select({ count: sql<number>`count(*)` })
      .from(tiendanubeWebhooksRaw)
      .where(and(eq(tiendanubeWebhooksRaw.storeId, storeId), gte(tiendanubeWebhooksRaw.createdAt, lastHour)))
      .then(r => r[0].count),
  ]);

  return {
    total,
    pending,
    retrying,
    processed,
    deadLetter,
    last24h: last24hCount,
    lastHour: lastHourCount,
  };
}

async function getSyncMetrics(storeId: string): Promise<SyncMetrics> {
  const [stats, syncState] = await Promise.all([
    db.select({
      totalProducts: sql<number>`count(*)`,
      synced: sql<number>`count(*) FILTER (WHERE sync_status = 'synced')`,
      pending: sql<number>`count(*) FILTER (WHERE sync_status = 'pending')`,
      error: sql<number>`count(*) FILTER (WHERE sync_status = 'error')`,
    })
    .from(tiendanubeProductMapping)
    .where(eq(tiendanubeProductMapping.storeId, storeId))
    .then(r => r[0]),
    
    db.query.tiendanubeSyncState.findFirst({
      where: eq(tiendanubeSyncState.storeId, storeId),
    }),
  ]);

  // Calcular productos con fallos consecutivos
  const consecutiveFailures = await db
    .select({ count: sql<number>`count(*)` })
    .from(tiendanubeProductMapping)
    .where(and(
      eq(tiendanubeProductMapping.storeId, storeId),
      gte(tiendanubeProductMapping.consecutiveFailures, 3)
    ))
    .then(r => r[0].count);

  return {
    ...stats,
    lastSyncAt: syncState?.lastSyncedAt || null,
    consecutiveFailures,
  };
}

async function getOrderMetrics(storeId: string): Promise<OrderMetrics> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalOrders, last24hOrders, lastWeekOrders, pendingOrders, totalCustomers] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.tiendanubeStoreId, storeId))
      .then(r => r[0].count),
    
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(
        eq(orders.tiendanubeStoreId, storeId),
        gte(orders.createdAt, last24h)
      ))
      .then(r => r[0].count),
    
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(
        eq(orders.tiendanubeStoreId, storeId),
        gte(orders.createdAt, lastWeek)
      ))
      .then(r => r[0].count),
    
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(
        eq(orders.tiendanubeStoreId, storeId),
        eq(orders.status, 'pending')
      ))
      .then(r => r[0].count),
    
    db.select({ count: sql<number>`count(DISTINCT user_id)` })
      .from(tiendanubeCustomerMapping)
      .where(eq(tiendanubeCustomerMapping.storeId, storeId))
      .then(r => r[0].count),
  ]);

  return {
    totalOrders,
    last24h: last24hOrders,
    lastWeek: lastWeekOrders,
    pendingOrders,
    totalCustomers,
  };
}

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

    // Obtener información básica de la tienda
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, storeId),
      columns: {
        storeId: true,
        status: true,
        installedAt: true,
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 });
    }

    // Obtener métricas en paralelo
    const [webhooks, sync, orders] = await Promise.all([
      getWebhookMetrics(storeId),
      getSyncMetrics(storeId),
      getOrderMetrics(storeId),
    ]);

    const metrics: DashboardMetrics = {
      store: {
        storeId: store.storeId,
        status: store.status,
        connectedAt: store.installedAt,
      },
      webhooks,
      sync,
      orders,
    };

    // Agregar timestamps para cacheo
    const response = NextResponse.json(metrics);
    response.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    
    return response;
  } catch (error) {
    logger.error('Error obteniendo métricas de Tiendanube', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error obteniendo métricas' },
      { status: 500 }
    );
  }
}

// Endpoint para obtener logs recientes (opcional, para debugging)
export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { storeId, type = 'webhooks', limit = 20 } = body;

    let logs: unknown[] = [];

    if (type === 'webhooks') {
      logs = await db
        .select()
        .from(tiendanubeWebhooksRaw)
        .where(lte(tiendanubeWebhooksRaw.createdAt, new Date(body.date)))
        .orderBy(desc(tiendanubeWebhooksRaw.createdAt))
        .limit(100);
    } else if (type === 'orders') {
      logs = await db
        .select({
          id: orders.id,
          tiendanubeOrderId: orders.tiendanubeOrderId,
          status: orders.status,
          total: orders.total,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.tiendanubeStoreId, storeId))
        .orderBy(desc(orders.createdAt))
        .limit(limit);
    }

    return NextResponse.json({ logs });
  } catch (error) {
    logger.error('Error obteniendo logs', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error obteniendo logs' },
      { status: 500 }
    );
  }
}
