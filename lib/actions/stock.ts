"use server";

import { db } from "@/lib/db";
import { stockLogs, products, productVariants } from "@/lib/schema";
import { eq, and, desc, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/actions/auth";
import { z } from "zod";

// Validaciones
const adjustStockSchema = z.object({
  productId: z.number().int().positive(),
  change: z.number().int(),
  reason: z.string().min(1).max(255),
});

const adjustVariantStockSchema = z.object({
  variantId: z.number().int().positive(),
  change: z.number().int(),
  reason: z.string().min(1).max(255),
});

/**
 * Ajusta el stock de un producto base
 */
export async function adjustProductStock(
  data: z.infer<typeof adjustStockSchema>,
  options?: { bypassAuth?: boolean; userId?: number }
) {
  try {
    let userId: number;

    if (options?.bypassAuth && options.userId) {
      // Bypass de autenticación para webhooks
      userId = options.userId;
    } else {
      // Autenticación normal
      const session = await auth();
      if (!session?.user?.id) {
        throw new Error("Usuario no autenticado");
      }
      userId = parseInt(session.user.id);
    }

    const validatedData = adjustStockSchema.parse(data);

    // Obtener stock actual
    const product = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, validatedData.productId))
      .limit(1);

    if (!product.length) {
      throw new Error("Producto no encontrado");
    }

    const currentStock = product[0].stock;
    // newStock ya no se usa directamente, se obtiene después del UPDATE

    // Actualizar stock del producto de forma atómica y sin permitir negativos
    await db
      .update(products)
      .set({ 
        stock: sql`GREATEST(0, ${products.stock} + ${validatedData.change})`,
        updated_at: new Date() 
      })
      .where(eq(products.id, validatedData.productId));

    // Obtener el nuevo stock real para el log
    const updatedProduct = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, validatedData.productId))
      .limit(1);
    const actualNewStock = updatedProduct[0].stock;

    // Registrar en logs con el valor real
    await db.insert(stockLogs).values({
      productId: validatedData.productId,
      oldStock: currentStock,
      newStock: actualNewStock,
      change: validatedData.change,
      reason: validatedData.reason,
      userId,
    });

    revalidatePath(`/admin/products/${validatedData.productId}/stock`);
    revalidatePath(`/admin/products/${validatedData.productId}/edit`);

    return { success: true, newStock: actualNewStock };
  } catch (error) {
    console.error("Error ajustando stock del producto:", error);
    throw new Error("Error al ajustar el stock del producto");
  }
}

/**
 * Ajusta el stock de una variante de producto
 */
export async function adjustVariantStock(
  data: z.infer<typeof adjustVariantStockSchema>,
  options?: { bypassAuth?: boolean; userId?: number }
) {
  try {
    let userId: number;

    if (options?.bypassAuth && options.userId) {
      // Bypass de autenticación para webhooks
      userId = options.userId;
    } else {
      // Autenticación normal
      const session = await auth();
      if (!session?.user?.id) {
        throw new Error("Usuario no autenticado");
      }
      userId = parseInt(session.user.id);
    }

    const validatedData = adjustVariantStockSchema.parse(data);

    // Obtener stock actual de la variante
    const variant = await db
      .select({ stock: productVariants.stock, productId: productVariants.productId, isActive: productVariants.isActive })
      .from(productVariants)
      .where(eq(productVariants.id, validatedData.variantId))
      .limit(1);

    if (!variant.length) {
      throw new Error("Variante no encontrada");
    }

    const currentStock = variant[0].stock;
    // shouldBeActive ya no se usa directamente, se calcula en el UPDATE

    // Actualizar stock de la variante y estado activo/inactivo de forma atómica y sin permitir negativos
    await db
      .update(productVariants)
      .set({
        stock: sql`GREATEST(0, ${productVariants.stock} + ${validatedData.change})`,
        isActive: sql`CASE WHEN GREATEST(0, ${productVariants.stock} + ${validatedData.change}) > 0 THEN true ELSE false END`,
        updated_at: new Date()
      })
      .where(eq(productVariants.id, validatedData.variantId));

    // Obtener el nuevo stock real para el log
    const updatedVariant = await db
      .select({ stock: productVariants.stock, isActive: productVariants.isActive })
      .from(productVariants)
      .where(eq(productVariants.id, validatedData.variantId))
      .limit(1);
    const actualNewStock = updatedVariant[0].stock;
    const actualIsActive = updatedVariant[0].isActive;

    // Registrar en logs con el valor real y referencia a variante
    await db.insert(stockLogs).values({
      productId: variant[0].productId,
      variantId: validatedData.variantId,
      oldStock: currentStock,
      newStock: actualNewStock,
      change: validatedData.change,
      reason: validatedData.reason,
      userId,
    });

    revalidatePath(`/admin/products/${variant[0].productId}/stock`);
    revalidatePath(`/admin/products/${variant[0].productId}/edit`);

    return { success: true, newStock: actualNewStock, isActive: actualIsActive };
  } catch (error) {
    console.error("Error ajustando stock de variante:", error);
    throw new Error("Error al ajustar el stock de la variante");
  }
}

/**
 * Obtiene el historial de cambios de stock para un producto
 */
export async function getStockHistory(productId: number, limit: number = 50, offset: number = 0) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Usuario no autenticado");
    }

    const history = await db
      .select({
        id: stockLogs.id,
        oldStock: stockLogs.oldStock,
        newStock: stockLogs.newStock,
        change: stockLogs.change,
        reason: stockLogs.reason,
        created_at: stockLogs.created_at,
        userId: stockLogs.userId,
      })
      .from(stockLogs)
      .where(eq(stockLogs.productId, productId))
      .orderBy(desc(stockLogs.created_at))
      .limit(limit)
      .offset(offset);

    return history;
  } catch (error) {
    console.error("Error obteniendo historial de stock:", error);
    throw new Error("Error al obtener el historial de stock");
  }
}

/**
 * Obtiene información completa de stock para un producto (base + variantes)
 */
export async function getProductStockInfo(productId: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Usuario no autenticado");
    }

    // Stock del producto base
    const productStock = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!productStock.length) {
      throw new Error("Producto no encontrado");
    }

    // Stock de variantes activas
    const variantsStock = await db
      .select({
        id: productVariants.id,
        additionalAttributes: productVariants.additionalAttributes,
        stock: productVariants.stock,
        isActive: productVariants.isActive,
      })
      .from(productVariants)
      .where(and(
        eq(productVariants.productId, productId),
        eq(productVariants.isActive, true)
      ));

    return {
      productStock: productStock[0].stock,
      variantsStock,
    };
  } catch (error) {
    console.error("Error obteniendo información de stock:", error);
    throw new Error("Error al obtener la información de stock");
  }
}

/**
 * Ajusta el stock de un producto a un valor específico (no incremental)
 */
export async function adjustStock(productId: number, newStock: number, reason: string, userId: number) {
  try {
    // Obtener stock actual
    const product = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product.length) {
      throw new Error("Producto no encontrado");
    }

    const currentStock = product[0].stock;
    const change = newStock - currentStock;

    // Actualizar stock del producto
    await db
      .update(products)
      .set({ stock: newStock, updated_at: new Date() })
      .where(eq(products.id, productId));

    // Registrar en logs
    await db.insert(stockLogs).values({
      productId,
      oldStock: currentStock,
      newStock,
      change,
      reason,
      userId,
    });

    revalidatePath(`/admin/products/${productId}/stock`);
    revalidatePath(`/admin/products/${productId}/edit`);

    return { success: true, newStock };
  } catch (error) {
    console.error("Error ajustando stock del producto:", error);
    throw new Error("Error al ajustar el stock del producto");
  }
}

/**
 * Obtiene el historial de cambios de stock para un producto (alias para getStockHistory)
 */
export async function getStockLogs(productId: number, limit: number = 50) {
  return getStockHistory(productId, limit);
}

/**
 * Obtiene productos con stock bajo
 */
export async function getLowStockProducts(threshold: number = 10) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Usuario no autenticado");
    }

    const lowStockProducts = await db
      .select({
        id: products.id,
        name: products.name,
        stock: products.stock,
        image: products.image,
      })
      .from(products)
      .where(lte(products.stock, threshold))
      .orderBy(products.name);

    return lowStockProducts;
  } catch (error) {
    console.error("Error obteniendo productos con stock bajo:", error);
    throw new Error("Error al obtener productos con stock bajo");
  }
}
