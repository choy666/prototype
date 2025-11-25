import { NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { mercadolibreProductsSync } from '@/lib/schema';
import { count } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

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

    return NextResponse.json({
      total,
      synced,
      pending,
      errors,
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

