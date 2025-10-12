// lib/utils/pricing.ts
import { Product } from "@/lib/schema";

export function getDiscountedPrice(product: Product): number {
  if (!product.discount || product.discount <= 0) return Number(product.price);
  return Number(product.price) * (1 - product.discount / 100);
}