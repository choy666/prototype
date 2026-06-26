'use server'

import { db } from '@/lib/db'
import { products, productVariants } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function getProductStockData(productId: number) {
  const product = await db
    .select({
      id: products.id,
      name: products.name,
      stock: products.stock,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  if (!product.length) {
    return null
  }

  const variants = await db
    .select({
      id: productVariants.id,
      name: productVariants.name,
      description: productVariants.description,
      additionalAttributes: productVariants.additionalAttributes,
      price: productVariants.price,
      stock: productVariants.stock,
      images: productVariants.images,
      isActive: productVariants.isActive,
    })
    .from(productVariants)
    .where(and(
      eq(productVariants.productId, productId),
      eq(productVariants.isActive, true)
    ))

  return {
    product: product[0],
    variants: variants.map(v => ({
      ...v,
      name: v.name || undefined,
      description: v.description || undefined,
      price: v.price ? parseFloat(v.price) : undefined,
      images: (v.images || []) as string[],
      additionalAttributes: (v.additionalAttributes || {}) as Record<string, string>,
    }))
  }
}
