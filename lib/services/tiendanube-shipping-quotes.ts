import crypto from 'crypto';
import { eq, and, gt, lt, desc } from 'drizzle-orm';

import { db } from '@/lib/db';
import { tiendanubeShippingQuotes, tiendanubeStores } from '@/lib/schema';
import {
  TiendanubeShippingOption,
  TiendanubeWebhookRequest,
  TiendanubeWebhookItem,
  tiendanubeWebhookService,
} from '@/lib/services/tiendanube-webhook-service';

type QuoteSource = 'tiendanube' | 'local';

const DEFAULT_TTL_MINUTES = Number(process.env.TIENDANUBE_QUOTE_TTL_MINUTES ?? '3');
const QUOTE_TTL_MS = DEFAULT_TTL_MINUTES * 60 * 1000;

export interface QuoteSignatureItem {
  id: string | number;
  grams?: number;
  quantity: number;
  price?: number;
}

export interface QuoteRecord {
  id: number;
  cartId: string | null;
  quoteKey: string;
  storeId: string;
  destinationZip: string;
  payload: TiendanubeWebhookRequest | Record<string, unknown>;
  options: TiendanubeShippingOption[];
  source: QuoteSource;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalQuoteItemInput {
  id: string | number;
  name?: string;
  quantity: number;
  price: number;
  weightGrams?: number | null;
  dimensions?: {
    length?: number | null;
    width?: number | null;
    height?: number | null;
  };
}

export interface LocalQuoteParams {
  quoteKey: string;
  destinationZip: string;
  items: LocalQuoteItemInput[];
  storeId?: string;
  cartId?: string | null;
  source?: QuoteSource;
}

export function buildQuoteKey(input: {
  storeId: string;
  destinationZip: string;
  items: QuoteSignatureItem[];
}): string {
  const normalizedItems = input.items
    .map((item) => ({
      id: item.id,
      quantity: item.quantity,
      grams: item.grams ?? 0,
      price: item.price ?? 0,
    }))
    .sort((a, b) => `${a.id}`.localeCompare(`${b.id}`))
    .map((item) => `${item.id}:${item.quantity}:${item.grams}:${item.price}`)
    .join('|');

  return crypto
    .createHash('sha256')
    .update(`${input.storeId}|${input.destinationZip}|${normalizedItems}`)
    .digest('hex');
}

export async function saveQuote(params: {
  storeId: string;
  cartId?: string | null;
  destinationZip: string;
  payload: TiendanubeWebhookRequest | Record<string, unknown>;
  options: TiendanubeShippingOption[];
  quoteKey: string;
  source?: QuoteSource;
  ttlMs?: number;
}): Promise<QuoteRecord> {
  const now = new Date();
  const ttlMs = params.ttlMs ?? QUOTE_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttlMs);

  const [record] = await db
    .insert(tiendanubeShippingQuotes)
    .values({
      cartId: params.cartId ?? null,
      quoteKey: params.quoteKey,
      storeId: params.storeId,
      destinationZip: params.destinationZip,
      payload: params.payload,
      options: params.options,
      source: params.source ?? 'tiendanube',
      expiresAt,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: tiendanubeShippingQuotes.quoteKey,
      set: {
        cartId: params.cartId ?? null,
        destinationZip: params.destinationZip,
        payload: params.payload,
        options: params.options,
        source: params.source ?? 'tiendanube',
        expiresAt,
        updatedAt: now,
      },
    })
    .returning();

  return record as QuoteRecord;
}

export async function getQuoteByKey(quoteKey: string): Promise<QuoteRecord | null> {
  const now = new Date();
  const record = await db.query.tiendanubeShippingQuotes.findFirst({
    where: and(
      eq(tiendanubeShippingQuotes.quoteKey, quoteKey),
      gt(tiendanubeShippingQuotes.expiresAt, now)
    ),
  });

  return record ? (record as QuoteRecord) : null;
}

export async function getQuoteByCartId(cartId: string): Promise<QuoteRecord | null> {
  const now = new Date();
  const record = await db.query.tiendanubeShippingQuotes.findFirst({
    where: and(
      eq(tiendanubeShippingQuotes.cartId, cartId),
      gt(tiendanubeShippingQuotes.expiresAt, now)
    ),
    orderBy: desc(tiendanubeShippingQuotes.updatedAt),
  });

  return record ? (record as QuoteRecord) : null;
}

export async function getLatestPayloadForStore(storeId: string): Promise<TiendanubeWebhookRequest | null> {
  const [record] = await db
    .select({ payload: tiendanubeShippingQuotes.payload })
    .from(tiendanubeShippingQuotes)
    .where(eq(tiendanubeShippingQuotes.storeId, storeId))
    .orderBy(desc(tiendanubeShippingQuotes.createdAt))
    .limit(1);

  if (!record?.payload) {
    return null;
  }

  return record.payload as TiendanubeWebhookRequest;
}

function buildFallbackCarrier(currency: string) {
  return {
    id: 'local-carrier',
    name: 'Envío Tiendanube',
    options: [
      {
        id: 'standard',
        name: 'Envío estándar',
        code: 'standard',
        allow_free_shipping: true,
        additional_cost: {
          amount: 0,
          currency,
        },
        additional_days: 2,
      },
    ],
  };
}

function normalizeWebhookItems(items: LocalQuoteItemInput[]): TiendanubeWebhookItem[] {
  return items.map((item, index) => ({
    id: typeof item.id === 'number' ? item.id : index,
    product_id: typeof item.id === 'number' ? item.id : index,
    name: item.name ?? `Producto ${item.id}`,
    sku: undefined,
    quantity: item.quantity,
    free_shipping: false,
    grams: Math.max(1, Math.round(item.weightGrams ?? 0)),
    price: item.price,
    dimensions: {
      width: Math.max(1, Math.round(item.dimensions?.width ?? 1)),
      height: Math.max(1, Math.round(item.dimensions?.height ?? 1)),
      depth: Math.max(1, Math.round(item.dimensions?.length ?? 1)),
    },
  }));
}

export async function createQuoteFromLocalData(params: LocalQuoteParams): Promise<QuoteRecord> {
  const settings = await db.query.shippingSettings.findFirst();
  const resolvedStoreId = params.storeId ?? settings?.tiendanubeStoreId;

  if (!resolvedStoreId) {
    throw new Error('No hay tienda de Tiendanube configurada.');
  }

  const store = await db.query.tiendanubeStores.findFirst({
    where: eq(tiendanubeStores.storeId, resolvedStoreId),
  });

  if (!store) {
    throw new Error(`Tienda Tiendanube ${resolvedStoreId} no encontrada.`);
  }

  const latestPayload = await getLatestPayloadForStore(resolvedStoreId);
  const carrier = latestPayload?.carrier?.options?.length
    ? latestPayload.carrier
    : buildFallbackCarrier(store.currency ?? 'ARS');

  const originZip =
    store.originZipCode ??
    (typeof store.originAddress === 'object' && store.originAddress
      ? (store.originAddress as Record<string, string>).zip_code
      : null) ??
    settings?.businessZipCode ??
    '0000';

  const originCity =
    (typeof store.originAddress === 'object' && store.originAddress
      ? (store.originAddress as Record<string, string>).city
      : undefined) ?? undefined;

  const originProvince =
    (typeof store.originAddress === 'object' && store.originAddress
      ? (store.originAddress as Record<string, string>).state
      : undefined) ?? undefined;

  const request: TiendanubeWebhookRequest = {
    cart_id: params.cartId ?? `local-${Date.now()}`,
    store_id: Number(resolvedStoreId),
    currency: store.currency ?? 'ARS',
    language: 'es',
    origin: {
      postal_code: originZip,
      city: originCity,
      province: originProvince,
      country: store.country ?? 'AR',
    },
    destination: {
      postal_code: params.destinationZip,
      country: store.country ?? 'AR',
    },
    items: normalizeWebhookItems(params.items),
    carrier,
  };

  const options = await tiendanubeWebhookService.calculateShippingRates(request);

  return saveQuote({
    storeId: resolvedStoreId,
    cartId: params.cartId ?? null,
    destinationZip: params.destinationZip,
    payload: request,
    options,
    quoteKey: params.quoteKey,
    source: params.source ?? 'local',
  });
}

export async function getOrCreateQuote(params: LocalQuoteParams): Promise<QuoteRecord> {
  if (params.cartId) {
    const cartQuote = await getQuoteByCartId(params.cartId);
    if (cartQuote) {
      return cartQuote;
    }
  }

  const cached = await getQuoteByKey(params.quoteKey);
  if (cached) {
    return cached;
  }

  return createQuoteFromLocalData(params);
}

export async function purgeExpiredQuotes(): Promise<number> {
  const now = new Date();
  const result = await db
    .delete(tiendanubeShippingQuotes)
    .where(lt(tiendanubeShippingQuotes.expiresAt, now))
    .returning({ id: tiendanubeShippingQuotes.id });

  return result.length;
}
