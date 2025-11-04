// lib/utils/pricing.ts
import { Product, ProductVariant } from '@/types/index'

// Tipo mínimo necesario
type Priceable = { price: string | number; discount: number }

/**
 * Calcula el precio final de un producto aplicando descuento si corresponde.
 * Puede recibir un Product completo o cualquier objeto con price y discount.
 */
export function getDiscountedPrice(product: Product | Priceable): number {
  const price = Number(product.price)
  if (!product.discount || product.discount <= 0) return price
  return price * (1 - product.discount / 100)
}

/**
 * Calcula el precio final considerando variante y descuento del producto padre.
 * Si la variante tiene precio, usa ese; sino usa el precio del producto.
 * Aplica el descuento del producto padre.
 */
export function getFinalPrice(product: Product, variant?: ProductVariant | null): number {
  const basePrice = variant?.price ? Number(variant.price) : Number(product.price)
  if (!product.discount || product.discount <= 0) return basePrice
  return basePrice * (1 - product.discount / 100)
}
