import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { 
  addToSyncQueue, 
  processBatch, 
  getQueueStats, 
  cleanupOldSyncedItems,
  retryFailedItems 
} from '@/lib/queue/sync-queue';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden ver la cola' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        const stats = await getQueueStats();
        return NextResponse.json({ success: true, stats });

      case 'cleanup':
        const daysOld = parseInt(searchParams.get('days') || '30');
        const deletedCount = await cleanupOldSyncedItems(daysOld);
        return NextResponse.json({ 
          success: true, 
          message: `Se eliminaron ${deletedCount} items antiguos`,
          deletedCount 
        });

      default:
        // Por defecto, retornar estadísticas
        const defaultStats = await getQueueStats();
        return NextResponse.json({ success: true, stats: defaultStats });
    }

  } catch (error) {
    logger.error('SyncQueue API: Error en GET', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden gestionar la cola' }, { status: 403 });
    }

    const body = await request.json();
    const { action, productId, productIds, priority, delayMinutes } = body;

    const userId = parseInt(session.user.id);

    switch (action) {
      case 'add':
        if (!productId) {
          return NextResponse.json({ error: 'productId es requerido' }, { status: 400 });
        }

        await addToSyncQueue(
          productId, 
          priority || 'normal', 
          delayMinutes || 0
        );

        logger.info('SyncQueue API: Producto agregado a cola', {
          userId,
          productId,
          priority,
          delayMinutes
        });

        return NextResponse.json({ 
          success: true, 
          message: 'Producto agregado a la cola de sincronización' 
        });

      case 'process':
        const results = await processBatch(userId);
        
        logger.info('SyncQueue API: Lote procesado', {
          userId,
          ...results
        });

        return NextResponse.json({ 
          success: true, 
          message: 'Lote procesado',
          results 
        });

      case 'retry':
        let retriedCount = 0;
        
        if (productIds && Array.isArray(productIds)) {
          // Reintentar productos específicos
          retriedCount = await retryFailedItems(productIds);
        } else {
          // Reintentar todos los fallidos
          retriedCount = await retryFailedItems();
        }

        logger.info('SyncQueue API: Items fallidos reintentados', {
          userId,
          productIds: productIds || 'all',
          retriedCount
        });

        return NextResponse.json({ 
          success: true, 
          message: `${retriedCount} items marcados para reintento`,
          retriedCount 
        });

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

  } catch (error) {
    logger.error('SyncQueue API: Error en POST', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
