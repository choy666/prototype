'use strict';

export interface QuoteItemInput {
  id: string | number;
  quantity: number;
  price: number;
}

function normalizeItems(items: QuoteItemInput[]): string {
  return items
    .map((item) => ({
      id: String(item.id),
      quantity: item.quantity,
      price: Number(item.price) || 0,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => `${item.id}:${item.quantity}:${item.price}`)
    .join('|');
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export function buildLocalCartId(zipcode: string, items: QuoteItemInput[]): string {
  const normalized = normalizeItems(items);
  const signature = simpleHash(`${zipcode}|${normalized}`);
  return `tnb-${zipcode}-${signature}`;
}
