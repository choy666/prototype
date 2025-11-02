'use server';

import { db } from '../db';
import { productAttributes, productVariants, products } from '../schema';
import { eq, and, sql } from 'drizzle-orm';
import type { NewProductAttribute, ProductAttribute, NewProductVariant, ProductVariant } from '../schema';

// ======================
// Atributos de productos
// ======================

// ✅ Crear un nuevo atributo
export async function createProductAttribute(
  data: Omit<NewProductAttribute, 'id' | 'created_at' | 'updated_at'>
): Promise<ProductAttribute> {
  try {
    const [newAttribute] = await db
      .insert(productAttributes)
      .values({
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    return newAttribute;
  } catch (error) {
    console.error('Error creating product attribute:', error);
    throw new Error('No se pudo crear el atributo del producto');
  }
}

// ✅ Obtener todos los atributos
export async function getProductAttributes(): Promise<ProductAttribute[]> {
  try {
    return await db.select().from(productAttributes).orderBy(productAttributes.name);
  } catch (error) {
    console.error('Error fetching product attributes:', error);
    throw new Error('No se pudieron obtener los atributos de productos');
  }
}

// ✅ Actualizar un atributo
export async function updateProductAttribute(
  id: number,
  data: Partial<Omit<NewProductAttribute, 'id' | 'created_at'>>
): Promise<ProductAttribute | null> {
  try {
    const [updatedAttribute] = await db
      .update(productAttributes)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(productAttributes.id, id))
      .returning();

    return updatedAttribute || null;
  } catch (error) {
    console.error('Error updating product attribute:', error);
    throw new Error('No se pudo actualizar el atributo del producto');
  }
}

// ✅ Eliminar un atributo (con validación de uso)
export async function deleteProductAttribute(id: number): Promise<boolean> {
  try {
    // Verificar si el atributo está siendo usado en variantes activas
    const [attributeUsage] = await db
      .select({ count: sql<number>`count(*)` })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.isActive, true),
          sql`attributes ? ${id.toString()}`
        )
      );

    if (attributeUsage.count > 0) {
      throw new Error('No se puede eliminar el atributo porque está siendo usado en variantes activas');
    }

    const [deletedAttribute] = await db
      .delete(productAttributes)
      .where(eq(productAttributes.id, id))
      .returning({ id: productAttributes.id });

    return !!deletedAttribute;
  } catch (error) {
    console.error('Error deleting product attribute:', error);
    throw new Error(error instanceof Error ? error.message : 'No se pudo eliminar el atributo del producto');
  }
}

// ======================
// Variantes de productos
// ======================

// ✅ Crear una nueva variante
export async function createProductVariant(
  data: Omit<NewProductVariant, 'id' | 'created_at' | 'updated_at'>
): Promise<ProductVariant> {
  try {
    // Remover sku si existe en los datos (para compatibilidad)
    const { sku, ...variantData } = data as Record<string, unknown>;

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
