// En lib/actions/products.ts
'use server';

import { db } from '@/lib/db';
import { products } from '@/lib/schema';
import { eq, desc, sql } from 'drizzle-orm';
import type { NewProduct, Product } from '@/lib/schema';

// Obtener todos los productos con paginación
export async function getProducts(page = 1, limit = 10) {
  const offset = (page - 1) * limit;
  
  return await db.transaction(async (tx) => {
    const data = await tx.query.products.findMany({
      orderBy: [desc(products.created_at)],
      limit,
      offset,
    });

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(products);

    return {
      data,
      pagination: {
        total: Number(count),
        page,
        totalPages: Math.ceil(Number(count) / limit),
      },
    };
  });
}

// Obtener un producto por ID
export async function getProductById(id: number): Promise<Product> {
  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
  });

  if (!product) {
    throw new Error('Producto no encontrado');
  }

  return product;
}

// Obtener productos destacados
export async function getFeaturedProducts(limit = 8) {
  return await db.query.products.findMany({
    where: eq(products.destacado, true),
    orderBy: [desc(products.created_at)],
    limit,
  });
}

// Crear un nuevo producto (solo admin)
export async function createProduct(productData: Omit<NewProduct, 'id' | 'createdAt' | 'updatedAt'>) {
  // Aquí podrías agregar validación con Zod
  const [newProduct] = await db.insert(products)
    .values({
      ...productData,
      created_at: new Date(), // Cambiado a snake_case
      updated_at: new Date(), // Cambiado a snake_case
    })
    .returning();

  return newProduct;
}

// Actualizar un producto (solo admin)
export async function updateProduct(id: number, productData: Partial<Omit<Product, 'id' | 'createdAt'>>) {
  const [updatedProduct] = await db
    .update(products)
    .set({
      ...productData,
      updated_at: new Date(),
    })
    .where(eq(products.id, id))
    .returning();

  if (!updatedProduct) {
    throw new Error('Producto no encontrado');
  }

  return updatedProduct;
}

// Eliminar un producto (solo admin)
export async function deleteProduct(id: number) {
  const [deletedProduct] = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning();

  if (!deletedProduct) {
    throw new Error('Producto no encontrado');
  }

  return deletedProduct;
}