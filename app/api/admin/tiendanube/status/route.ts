import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { getTiendanubeConfig } from '@/lib/config/integrations';
import { listRemoteWebhooks, getTiendanubeWebhookTargetUrl, REQUIRED_TIENDANUBE_WEBHOOK_EVENTS, createClientForStore } from '@/lib/services/tiendanube/webhooks';

export const runtime = 'nodejs';

function hasTiendanubeConfig() {
  const cfg = getTiendanubeConfig();
  return {
    ok: Boolean(cfg.appId && cfg.clientSecret && cfg.userAgent && cfg.webhooksBaseUrl),
    config: {
      appId: cfg.appId ? String(cfg.appId) : undefined,
      apiBase: cfg.apiBase,
      authBase: cfg.authBase,
      hasClientSecret: Boolean(cfg.clientSecret),
      userAgent: cfg.userAgent,
      webhooksBaseUrl: cfg.webhooksBaseUrl,
      webhookUrl: cfg.webhooksBaseUrl ? getTiendanubeWebhookTargetUrl() : undefined,
    },
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');
  const verify = searchParams.get('verify') === 'true' || searchParams.get('verify') === '1';

  const configStatus = hasTiendanubeConfig();

  const stores = await db.query.tiendanubeStores.findMany({
    columns: {
      storeId: true,
      scopes: true,
      status: true,
      installedAt: true,
      uninstalledAt: true,
      lastSyncAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: (tiendanubeStores, { desc }) => [desc(tiendanubeStores.updatedAt)],
  });

  if (!storeId) {
    return NextResponse.json({
      configured: configStatus.ok,
      config: configStatus.config,
      stores,
    });
  }

  let remoteWebhooks: unknown = null;
  let webhooksError: string | null = null;

  try {
    remoteWebhooks = await listRemoteWebhooks(storeId);
  } catch (err) {
    webhooksError = err instanceof Error ? err.message : String(err);
  }

  let storeInfo: unknown = null;
  let storeInfoError: string | null = null;

  if (verify && !webhooksError) {
    try {
      const client = await createClientForStore(storeId);
      storeInfo = await client.get('/store');
    } catch (err) {
      storeInfoError = err instanceof Error ? err.message : String(err);
    }
  }

  const webhookUrl = configStatus.config.webhookUrl;

  let requiredStatus: Array<{
    event: string;
    state: 'ok' | 'missing' | 'url_mismatch' | 'unknown';
    id?: number;
    url?: string;
  }> = [];

  if (Array.isArray(remoteWebhooks) && webhookUrl) {
    const byEvent = new Map<string, { id: number; url: string }>();
    for (const hook of remoteWebhooks as Array<{ event: string; id: number; url: string }>) {
      if (!byEvent.has(hook.event)) {
        byEvent.set(hook.event, { id: hook.id, url: hook.url });
      }
    }

    requiredStatus = REQUIRED_TIENDANUBE_WEBHOOK_EVENTS.map((event) => {
      const found = byEvent.get(event);
      if (!found) {
        return { event, state: 'missing' as const };
      }

      if (found.url !== webhookUrl) {
        return { event, state: 'url_mismatch' as const, id: found.id, url: found.url };
      }

      return { event, state: 'ok' as const, id: found.id, url: found.url };
    });
  } else {
    requiredStatus = REQUIRED_TIENDANUBE_WEBHOOK_EVENTS.map((event) => ({ event, state: 'unknown' as const }));
  }

  return NextResponse.json({
    configured: configStatus.ok,
    config: configStatus.config,
    stores,
    selectedStoreId: storeId,
    remoteWebhooks,
    webhooksError,
    storeInfo,
    storeInfoError,
    requiredWebhooks: {
      webhookUrl,
      requiredStatus,
    },
  });
}
