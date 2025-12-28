import { NextRequest, NextResponse } from 'next/server';
import { and, count, desc, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  mercadolibreWebhooks,
  webhookFailures,
} from '@/lib/schema';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { logger } from '@/lib/utils/logger';

export async function GET(req: NextRequest) {
  try {
    await requireAdminAuth(req);

    const [mlSummaryRow] = await db
      .select({
        total: count(mercadolibreWebhooks.id),
        pending: sql<number>`COALESCE(SUM(CASE WHEN ${mercadolibreWebhooks.processed} = false THEN 1 ELSE 0 END), 0)`,
        failed: sql<number>`COALESCE(SUM(CASE WHEN ${mercadolibreWebhooks.errorMessage} IS NOT NULL THEN 1 ELSE 0 END), 0)`,
        lastEvent: sql<Date | null>`MAX(${mercadolibreWebhooks.createdAt})`,
      })
      .from(mercadolibreWebhooks);

    const [mpSummaryRow] = await db
      .select({
        total: count(webhookFailures.id),
        pending: sql<number>`COALESCE(SUM(CASE WHEN ${webhookFailures.status} = 'retrying' THEN 1 ELSE 0 END), 0)`,
        failed: sql<number>`COALESCE(SUM(CASE WHEN ${webhookFailures.status} = 'failed' THEN 1 ELSE 0 END), 0)`,
        deadLetter: sql<number>`COALESCE(SUM(CASE WHEN ${webhookFailures.status} = 'dead_letter' THEN 1 ELSE 0 END), 0)`,
        lastEvent: sql<Date | null>`MAX(${webhookFailures.createdAt})`,
      })
      .from(webhookFailures);

    const mlSummary = {
      total: Number(mlSummaryRow?.total ?? 0),
      pending: Number(mlSummaryRow?.pending ?? 0),
      failed: Number(mlSummaryRow?.failed ?? 0),
      lastEventAt: mlSummaryRow?.lastEvent
        ? new Date(mlSummaryRow.lastEvent).toISOString()
        : null,
    };

    const mpSummary = {
      total: Number(mpSummaryRow?.total ?? 0),
      pending: Number(mpSummaryRow?.pending ?? 0),
      failed: Number(mpSummaryRow?.failed ?? 0),
      deadLetter: Number(mpSummaryRow?.deadLetter ?? 0),
      lastEventAt: mpSummaryRow?.lastEvent
        ? new Date(mpSummaryRow.lastEvent).toISOString()
        : null,
    };

    const mlFailures = await db
      .select({
        id: mercadolibreWebhooks.id,
        topic: mercadolibreWebhooks.topic,
        resource: mercadolibreWebhooks.resource,
        processed: mercadolibreWebhooks.processed,
        errorMessage: mercadolibreWebhooks.errorMessage,
        retryCount: mercadolibreWebhooks.retryCount,
        createdAt: mercadolibreWebhooks.createdAt,
        processedAt: mercadolibreWebhooks.processedAt,
      })
      .from(mercadolibreWebhooks)
      .where(
        and(
          sql`(${mercadolibreWebhooks.processed} = false OR ${mercadolibreWebhooks.errorMessage} IS NOT NULL)`,
        ),
      )
      .orderBy(desc(mercadolibreWebhooks.createdAt))
      .limit(10);

    const mpFailures = await db
      .select({
        id: webhookFailures.id,
        paymentId: webhookFailures.paymentId,
        requestId: webhookFailures.requestId,
        status: webhookFailures.status,
        retryCount: webhookFailures.retryCount,
        errorMessage: webhookFailures.errorMessage,
        nextRetryAt: webhookFailures.nextRetryAt,
        createdAt: webhookFailures.createdAt,
        lastRetryAt: webhookFailures.lastRetryAt,
      })
      .from(webhookFailures)
      .orderBy(desc(webhookFailures.createdAt))
      .limit(10);

    const latestFailures = [
      ...mlFailures.map((failure) => ({
        id: failure.id,
        platform: 'mercadolibre' as const,
        paymentId: null,
        requestId: null,
        topic: failure.topic,
        resource: failure.resource,
        status: failure.processed ? 'processed' : 'pending',
        retryCount: failure.retryCount ?? 0,
        errorMessage: failure.errorMessage,
        nextRetryAt: null,
        createdAt: failure.createdAt?.toISOString?.()
          ? failure.createdAt.toISOString()
          : null,
        lastRetryAt: failure.processedAt?.toISOString?.()
          ? failure.processedAt.toISOString()
          : null,
      })),
      ...mpFailures.map((failure) => ({
        id: failure.id,
        platform: 'mercadopago' as const,
        paymentId: failure.paymentId,
        requestId: failure.requestId,
        topic: null,
        resource: null,
        status: failure.status,
        retryCount: failure.retryCount ?? 0,
        errorMessage: failure.errorMessage,
        nextRetryAt: failure.nextRetryAt?.toISOString?.()
          ? failure.nextRetryAt.toISOString()
          : null,
        createdAt: failure.createdAt?.toISOString?.()
          ? failure.createdAt.toISOString()
          : null,
        lastRetryAt: failure.lastRetryAt?.toISOString?.()
          ? failure.lastRetryAt.toISOString()
          : null,
      })),
    ]
      .sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 10);

    const alerts: Array<{
      severity: 'ok' | 'warning' | 'error';
      title: string;
      description: string;
      remediation?: string;
    }> = [];

    if (mpSummary.deadLetter > 0) {
      alerts.push({
        severity: 'error',
        title: 'Webhooks en dead letter',
        description: `${mpSummary.deadLetter} notificaciones de Mercado Pago agotaron los reintentos.`,
        remediation:
          'Revise los IDs afectados, ejecute el reintento manual y valide la firma HMAC.',
      });
    }

    if (mpSummary.failed > 0) {
      alerts.push({
        severity: 'error',
        title: 'Reintentos de Mercado Pago con fallos',
        description: `${mpSummary.failed} notificaciones están fallando de forma recurrente.`,
        remediation:
          'Verifique los logs HMAC, el estado del pago en la API oficial y vuelva a habilitar el Webhook.',
      });
    }

    if (mlSummary.failed > 0) {
      alerts.push({
        severity: 'warning',
        title: 'Errores en webhooks de Mercado Libre',
        description: `${mlSummary.failed} eventos presentan errores en el procesamiento local.`,
        remediation:
          'Revise el panel de webhooks ML, reprocesa el evento y confirma la suscripción desde la consola de ML.',
      });
    }

    if (mpSummary.pending > 0) {
      alerts.push({
        severity: 'warning',
        title: 'Reintentos programados',
        description: `${mpSummary.pending} notificaciones de Mercado Pago están en cola de reintentos.`,
        remediation:
          'Monitorea el próximo horario de ejecución y reintenta manualmente si el cliente lo requiere.',
      });
    }

    const lastEventCandidates = [
      mlSummary.lastEventAt,
      mpSummary.lastEventAt,
    ].filter(Boolean) as string[];

    const lastEventAt = lastEventCandidates.length
      ? new Date(
          Math.max(
            ...lastEventCandidates.map((value) => new Date(value).getTime()),
          ),
        ).toISOString()
      : null;

    return NextResponse.json({
      total: mlSummary.total + mpSummary.total,
      pending: mlSummary.pending + mpSummary.pending,
      failed: mlSummary.failed + mpSummary.failed,
      deadLetter: mpSummary.deadLetter,
      lastEventAt,
      alerts,
      latestFailures,
    });
  } catch (error) {
    logger.error('Error obteniendo resumen de webhooks', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: 'No se pudo obtener el resumen de webhooks',
      },
      { status: 500 },
    );
  }
}
