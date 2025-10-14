// lib/utils/pricing.ts
import { Product } from '@/types/index'

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