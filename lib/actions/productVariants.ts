'use server';

import { db } from '../db';
import { productVariants, products } from '../schema';
import { eq, and } from 'drizzle-orm';
import type { NewProductVariant, ProductVariant } from '../schema';



// ======================
// Variantes de productos
// ======================

// ✅ Crear una nueva variante
export async function createProductVariant(
  data: Omit<NewProductVariant, 'id' | 'created_at' | 'updated_at'>
): Promise<ProductVariant> {
  try {
    const {...variantData } = data as Record<string, unknown>;

    const [newVariant] = await db
      .insert(productVariants)
      .values({
        ...(variantData as Omit<NewProductVariant, 'id' | 'created_at' | 'updated_at'>),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    return newVariant;
  } catch (error) {
    console.error('Error creating product variant:', error);
    throw new Error('No se pudo crear la variante del producto');
  }
}

// ✅ Obtener variantes de un producto
export async function getProductVariants(productId: number): Promise<ProductVariant[]> {
  try {
    const variants = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, productId), eq(productVariants.isActive, true)))
      .orderBy(productVariants.created_at);

    // Asegurar que attributes sea Record<string, string>
    return variants.map(variant => ({
      ...variant,
      attributes: variant.attributes as Record<string, string>,
    }));
  } catch (error) {
    console.error('Error fetching product variants:', error);
    throw new Error('No se pudieron obtener las variantes del producto');
  }
}

// ✅ Actualizar una variante
export async function updateProductVariant(
  id: number,
  data: Partial<Omit<NewProductVariant, 'id' | 'created_at'>>
): Promise<ProductVariant | null> {
  try {
    const [updatedVariant] = await db
      .update(productVariants)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(productVariants.id, id))
      .returning();

    return updatedVariant || null;
  } catch (error) {
    console.error('Error updating product variant:', error);
    throw new Error('No se pudo actualizar la variante del producto');
  }
}

// ✅ Eliminar una variante (desactivar)
export async function deleteProductVariant(id: number): Promise<boolean> {
  try {
    const [deletedVariant] = await db
      .update(productVariants)
      .set({ isActive: false, updated_at: new Date() })
      .where(eq(productVariants.id, id))
      .returning({ id: productVariants.id });

    return !!deletedVariant;
  } catch (error) {
    console.error('Error deleting product variant:', error);
    throw new Error('No se pudo eliminar la variante del producto');
  }
}

// ✅ Obtener stock total de un producto incluyendo variantes
export async function getTotalProductStock(productId: number): Promise<number> {
  try {
    // Obtener stock base del producto
    const [product] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productId));

    if (!product) return 0;

    // Obtener stock de variantes activas
    const variants = await db
      .select({ stock: productVariants.stock })
      .from(productVariants)
      .where(and(eq(productVariants.productId, productId), eq(productVariants.isActive, true)));

    const variantsStock = variants.reduce((total, variant) => total + variant.stock, 0);

    return product.stock + variantsStock;
  } catch (error) {
    console.error('Error calculating total product stock:', error);
    return 0;
  }
}
