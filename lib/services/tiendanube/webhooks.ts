import { eq } from 'drizzle-orm';

import { createTiendanubeClient } from '@/lib/clients/tiendanube';
import { getTiendanubeConfig } from '@/lib/config/integrations';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { decryptString } from '@/lib/utils/encryption';

export type TiendanubeWebhookConfig = {
  created_at?: string;
  updated_at?: string;
  event: string;
  id: number;
  url: string;
};

export type TiendanubeWebhookUpsertResult = {
  event: string;
  status: 'created' | 'updated' | 'unchanged' | 'error';
  id?: number;
  url?: string;
  error?: string;
};

export const REQUIRED_TIENDANUBE_WEBHOOK_EVENTS = [
  'store/redact',
  'customers/redact',
  'customers/data_request',
] as const;

export const DEFAULT_TIENDANUBE_WEBHOOK_EVENTS = [
  ...REQUIRED_TIENDANUBE_WEBHOOK_EVENTS,
  'app/uninstalled',
  'order/created',
  'order/updated',
  'order/paid',
  'order/cancelled',
  'product/created',
  'product/updated',
  'product/deleted',
] as const;

function normalizeUrlJoin(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function getTiendanubeWebhookTargetUrl(): string {
  const config = getTiendanubeConfig();

  if (!config.webhooksBaseUrl) {
    throw new Error('INTEGRATION_WEBHOOKS_BASE_URL no configurado');
  }

  return normalizeUrlJoin(config.webhooksBaseUrl, '/api/tiendanube/webhooks');
}

export async function getConnectedTiendanubeStoreIds(): Promise<string[]> {
  const rows = await db.query.tiendanubeStores.findMany({
    columns: {
      storeId: true,
      status: true,
    },
  });

  return rows
    .filter((row) => row.status === 'connected')
    .map((row) => row.storeId);
}

export async function createClientForStore(storeId: string) {
  const store = await db.query.tiendanubeStores.findFirst({
    where: eq(tiendanubeStores.storeId, storeId),
    columns: {
      storeId: true,
      accessTokenEncrypted: true,
      status: true,
    },
  });

  if (!store) {
    throw new Error(`Tienda Tiendanube no encontrada: ${storeId}`);
  }

  if (store.status !== 'connected') {
    throw new Error(`Tienda Tiendanube no conectada: ${storeId}`);
  }

  const accessToken = decryptString(store.accessTokenEncrypted);

  return createTiendanubeClient({
    storeId: store.storeId,
    accessToken,
  });
}

export async function listRemoteWebhooks(storeId: string): Promise<TiendanubeWebhookConfig[]> {
  const client = await createClientForStore(storeId);
  return client.get<TiendanubeWebhookConfig[]>('/webhooks');
}

export async function upsertWebhooksForStore(params: {
  storeId: string;
  events?: readonly string[];
}): Promise<{
  storeId: string;
  webhookUrl: string;
  results: TiendanubeWebhookUpsertResult[];
  existing: TiendanubeWebhookConfig[];
}> {
  const { storeId, events = DEFAULT_TIENDANUBE_WEBHOOK_EVENTS } = params;

  const client = await createClientForStore(storeId);
  const webhookUrl = getTiendanubeWebhookTargetUrl();

  const existing = await client.get<TiendanubeWebhookConfig[]>('/webhooks');
  const existingByEvent = new Map<string, TiendanubeWebhookConfig>();

  for (const hook of existing) {
    if (!existingByEvent.has(hook.event)) {
      existingByEvent.set(hook.event, hook);
    }
  }

  const results: TiendanubeWebhookUpsertResult[] = [];

  for (const event of events) {
    const found = existingByEvent.get(event);

    if (!found) {
      try {
        const created = await client.post<TiendanubeWebhookConfig>('/webhooks', {
          event,
          url: webhookUrl,
        });
        results.push({
          event,
          status: 'created',
          id: created.id,
          url: created.url,
        });
      } catch (error) {
        results.push({
          event,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
      continue;
    }

    if (found.url !== webhookUrl) {
      try {
        const updated = await client.put<TiendanubeWebhookConfig>(`/webhooks/${found.id}`, {
          ...found,
          url: webhookUrl,
        });

        results.push({
          event,
          status: 'updated',
          id: updated.id,
          url: updated.url,
        });
      } catch (error) {
        results.push({
          event,
          status: 'error',
          id: found.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      continue;
    }

    results.push({
      event,
      status: 'unchanged',
      id: found.id,
      url: found.url,
    });
  }

  return {
    storeId,
    webhookUrl,
    results,
    existing,
  };
}
