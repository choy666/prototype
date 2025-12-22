import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/actions/auth';
import { upsertWebhooksForStore, DEFAULT_TIENDANUBE_WEBHOOK_EVENTS } from '@/lib/services/tiendanube/webhooks';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const storeId = typeof body === 'object' && body && 'storeId' in body ? String((body as { storeId: unknown }).storeId) : '';

  if (!storeId) {
    return NextResponse.json({ error: 'storeId requerido' }, { status: 400 });
  }

  const events =
    typeof body === 'object' && body && 'events' in body && Array.isArray((body as { events: unknown }).events)
      ? ((body as { events: unknown }).events as unknown[]).map(String)
      : DEFAULT_TIENDANUBE_WEBHOOK_EVENTS;

  try {
    const result = await upsertWebhooksForStore({
      storeId,
      events,
    });

    const ok = result.results.every((r) => r.status !== 'error');

    return NextResponse.json({
      success: ok,
      storeId: result.storeId,
      webhookUrl: result.webhookUrl,
      results: result.results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
