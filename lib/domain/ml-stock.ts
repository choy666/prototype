import type { Product } from '@/lib/schema';

export type MLStockPolicy = 'UNIQUE' | 'MULTI';

export function resolveStockPolicy(params: {
  categoryId?: string | null;
  condition?: string | null;
  listingTypeId?: string | null;
}): MLStockPolicy {
  const listingTypeId = params.listingTypeId ?? null;

  if (listingTypeId === 'free') {
    return 'UNIQUE';
  }

  return 'MULTI';
}

export function calculateAvailableQuantityForML(
  stock: number,
  stockPolicy: MLStockPolicy,
  maxPerListing?: number | null
): number {
  const safeStock = Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0;

  if (safeStock <= 0) {
    return 0;
  }

  if (stockPolicy === 'UNIQUE') {
    return 1;
  }

  if (typeof maxPerListing === 'number' && Number.isFinite(maxPerListing) && maxPerListing > 0) {
    const cap = Math.floor(maxPerListing);
    return Math.max(0, Math.min(safeStock, cap));
  }

  return safeStock;
}

export function calculateAvailableQuantityFromProduct(product: Product): number {
  const policy = resolveStockPolicy({
    categoryId: product.mlCategoryId ?? undefined,
    condition: product.mlCondition ?? undefined,
    listingTypeId: product.mlListingTypeId ?? undefined,
  });

  return calculateAvailableQuantityForML(product.stock ?? 0, policy);
}
