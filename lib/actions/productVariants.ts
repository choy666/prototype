"use server";

import { db } from "@/lib/db";
import { productVariants } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { NewProductVariant, ProductVariant } from "@/lib/schema";

/**
 * Obtiene todas las variantes de un producto
 */
export async function getProductVariants(productId: number): Promise<ProductVariant[]> {
  try {
    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId))
      .orderBy(productVariants.created_at);

    return variants;
  } catch (error) {
    console.error("Error obteniendo variantes del producto:", error);
    throw new Error("No se pudieron obtener las variantes del producto");
  }
}

/**
 * Crea una nueva variante de producto
 */
export async function createProductVariant(
  variantData: Omit<NewProductVariant, "id" | "created_at" | "updated_at">
): Promise<ProductVariant> {
  try {
    const [newVariant] = await db
      .insert(productVariants)
      .values({
        ...variantData,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    revalidatePath(`/admin/products/${variantData.productId}/edit`);
    revalidatePath(`/admin/products/${variantData.productId}/stock`);

    return newVariant;
  } catch (error) {
    console.error("Error creando variante:", error);
    throw new Error("No se pudo crear la variante");
  }
}

/**
 * Actualiza una variante de producto
 */
export async function updateProductVariant(
  id: number,
  variantData: Partial<Omit<NewProductVariant, "id" | "created_at">>
): Promise<ProductVariant | null> {
  try {
    const [updatedVariant] = await db
      .update(productVariants)
      .set({
        ...variantData,
        updated_at: new Date(),
      })
      .where(eq(productVariants.id, id))
      .returning();

    if (updatedVariant) {
      revalidatePath(`/admin/products/${updatedVariant.productId}/edit`);
      revalidatePath(`/admin/products/${updatedVariant.productId}/stock`);
    }

    return updatedVariant || null;
  } catch (error) {
    console.error("Error actualizando variante:", error);
    throw new Error("No se pudo actualizar la variante");
  }
}

/**
 * Elimina una variante de producto
 */
export async function deleteProductVariant(id: number): Promise<boolean> {
  try {
    const [deletedVariant] = await db
      .delete(productVariants)
      .where(eq(productVariants.id, id))
      .returning({ productId: productVariants.productId });

    if (deletedVariant) {
      revalidatePath(`/admin/products/${deletedVariant.productId}/edit`);
      revalidatePath(`/admin/products/${deletedVariant.productId}/stock`);
    }

    return !!deletedVariant;
  } catch (error) {
    console.error("Error eliminando variante:", error);
    throw new Error("No se pudo eliminar la variante");
  }
}
