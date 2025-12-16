import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { mercadolibreWebhooks, mercadolibreProductsSync } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { importMercadoLibreOrderById } from '@/lib/services/mercadolibre/orders-import';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const webhookId = Number(body.webhookId);

    if (!webhookId || Number.isNaN(webhookId)) {
      return NextResponse.json({ error: 'webhookId inválido' }, { status: 400 });
    }

    const webhook = await db.query.mercadolibreWebhooks.findFirst({
      where: eq(mercadolibreWebhooks.id, webhookId),
    });

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook no encontrado' }, { status: 404 });
    }

    logger.warn('[AUDIT] Reproceso manual de webhook ML solicitado', {
      webhookId,
      adminUserId: session.user.id,
      topic: webhook.topic,
      resource: webhook.resource,
    });

    try {
      const resourceId = webhook.resourceId || webhook.resource?.split('/').pop() || null;

      if (webhook.topic === 'orders') {
        if (!resourceId) {
          throw new Error('resourceId de orden no válido');
        }
        if (!webhook.userId) {
          throw new Error('Webhook sin userId local; no se puede importar la orden');
        }

        await importMercadoLibreOrderById({
          localUserId: webhook.userId,
          mlOrderId: resourceId,
        });
      }

      if (webhook.topic === 'items') {
        if (!resourceId) {
          throw new Error('resourceId de item no válido');
        }

        const syncRecord = await db.query.mercadolibreProductsSync.findFirst({
          where: eq(mercadolibreProductsSync.mlItemId, resourceId),
        });

        if (syncRecord) {
          await db
            .update(mercadolibreProductsSync)
            .set({
              lastSyncAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(mercadolibreProductsSync.id, syncRecord.id));
        }
      }

      await db
        .update(mercadolibreWebhooks)
        .set({
          processed: true,
          processedAt: new Date(),
          errorMessage: null,
          retryCount: sql`${mercadolibreWebhooks.retryCount} + 1`,
        })
        .where(eq(mercadolibreWebhooks.id, webhookId));

      return NextResponse.json({
        success: true,
        webhookId,
        processed: true,
      });
    } catch (processError) {
      const message = processError instanceof Error ? processError.message : String(processError);

      await db
        .update(mercadolibreWebhooks)
        .set({
          processed: false,
          processedAt: new Date(),
          errorMessage: message,
          retryCount: sql`${mercadolibreWebhooks.retryCount} + 1`,
        })
        .where(eq(mercadolibreWebhooks.id, webhookId));

      return NextResponse.json(
        {
          success: false,
          webhookId,
          processed: false,
          error: message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error en reproceso manual de webhook ML', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
