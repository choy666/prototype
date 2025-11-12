"use server";

import { db } from "@/lib/db";
import { stockLogs, products, productVariants } from "@/lib/schema";
import { eq, and, desc, lte } from "drizzle-orm";
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
export async function adjustProductStock(data: z.infer<typeof adjustStockSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Usuario no autenticado");
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
    const newStock = Math.max(0, currentStock + validatedData.change); // No permitir stock negativo

    // Actualizar stock del producto
    await db
      .update(products)
      .set({ stock: newStock, updated_at: new Date() })
      .where(eq(products.id, validatedData.productId));

    // Registrar en logs
    await db.insert(stockLogs).values({
      productId: validatedData.productId,
      oldStock: currentStock,
      newStock,
      change: validatedData.change,
      reason: validatedData.reason,
      userId: parseInt(session.user.id),
    });

    revalidatePath(`/admin/products/${validatedData.productId}/stock`);
    revalidatePath(`/admin/products/${validatedData.productId}/edit`);

    return { success: true, newStock };
  } catch (error) {
    console.error("Error ajustando stock del producto:", error);
    throw new Error("Error al ajustar el stock del producto");
  }
}

/**
 * Ajusta el stock de una variante de producto
 */
export async function adjustVariantStock(data: z.infer<typeof adjustVariantStockSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Usuario no autenticado");
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
    const newStock = Math.max(0, currentStock + validatedData.change); // No permitir stock negativo

    // Determinar si la variante debe estar activa o inactiva basado en el nuevo stock
    const shouldBeActive = newStock > 0;

    // Actualizar stock de la variante y estado activo/inactivo
    await db
      .update(productVariants)
      .set({
        stock: newStock,
        isActive: shouldBeActive,
        updated_at: new Date()
      })
      .where(eq(productVariants.id, validatedData.variantId));

    // Registrar en logs (usando productId de la variante)
    await db.insert(stockLogs).values({
      productId: variant[0].productId,
      oldStock: currentStock,
      newStock,
      change: validatedData.change,
      reason: validatedData.reason,
      userId: parseInt(session.user.id),
    });

    revalidatePath(`/admin/products/${variant[0].productId}/stock`);
    revalidatePath(`/admin/products/${variant[0].productId}/edit`);

    return { success: true, newStock, isActive: shouldBeActive };
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
