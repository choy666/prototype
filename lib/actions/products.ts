// En lib/actions/products.ts
'use server';

import { db } from '../db';
import { products } from '../schema';
import { and, eq, desc, sql, gte, lte, like, asc } from 'drizzle-orm';
import type { NewProduct, Product } from '../schema';
import { revalidatePath } from 'next/cache';


import { z } from 'zod';

// Esquema de validación para los filtros de productos
const productFiltersSchema = z.object({
  category: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(['name', 'price', 'category', 'created_at', 'updated_at', 'stock'])
    .default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

type ProductFilters = z.infer<typeof productFiltersSchema>;
// Obtener productos con paginación y filtros
export async function getProducts(
  page = 1, 
  limit = 10,
  filters: Partial<ProductFilters> = {}
  ) {
    try {
    // 1. Validar y sanitizar los parámetros de entrada
    const validatedPage = z.coerce.number().int().min(1).default(1).parse(page);
    const validatedLimit = z.coerce.number().int().min(1).default(10).parse(limit);
    const validatedFilters = productFiltersSchema.parse(filters);

    const offset = (validatedPage - 1) * validatedLimit;
    const {
      category,
      minPrice,
      maxPrice,
      search,
      sortBy,
      sortOrder,
    } = validatedFilters;
    
    // Construir condiciones de filtro
    const conditions = [];
    if (category) conditions.push(eq(products.category, category));
    if (minPrice !== undefined)
      conditions.push(gte(products.price, minPrice.toString()));
    if (maxPrice !== undefined)
      conditions.push(lte(products.price, maxPrice.toString()));
    if (search) conditions.push(like(products.name, `%${search}%`));

    // 3. Obtener datos y conteo total en paralelo para eficiencia
    const [data, countResult] = await Promise.all([
        db.query.products.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          orderBy: (sortOrder === 'desc' ? desc : asc)(products[sortBy]),
          limit: validatedLimit,
          offset,
        }),
        db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);
    const count = countResult[0]?.count || 0;
    return {
      data,
      pagination: {
        total: Number(count),
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(Number(count) / validatedLimit),
      },
      filters: validatedFilters,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues);
      throw new Error('Parametros de filtros invalidos');
    }
    console.error('Error fetching products:', error);
    throw new Error('No se pudieron obtener los productos.');
  }
}

// Obtener un producto por ID
export async function getProductById(id: number): Promise<Product | null> {
  try {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || null;
  } catch (error) {
    console.error('Error fetching product by id:', error);
    throw new Error('No se pudieron obtener los productos');
  }
}

// Obtener categorías únicas
export async function getCategories(): Promise<string[]> {
  try {
    const result = await db
      .select({ category: products.category })
      .from(products)
      .groupBy(products.category);
    return result.map(r => r.category);
  } catch (error) {
    console.error('No se pudieron encontraron los productos:', error);
    return [];
  }
}

// Crear un nuevo producto
export async function createProduct(
  productData: Omit<NewProduct, 'id' | 'created_at' | 'updated_at'>
): Promise<Product> {
  try {
    const [newProduct] = await db
      .insert(products)
      .values({
        ...productData,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();
    
    revalidatePath('/products');
    return newProduct;
  } catch (error) {
    console.error('Error creating product:', error);
    throw new Error('No se pudo crear el producto');
  }
}

// Actualizar un producto
export async function updateProduct(
  id: number, 
  productData: Partial<Omit<NewProduct, 'id' | 'created_at'>>
): Promise<Product | null> {
  try {
    const [updatedProduct] = await db
      .update(products)
      .set({
        ...productData,
        updated_at: new Date(),
      })
      .where(eq(products.id, id))
      .returning();
    
    revalidatePath(`/products/${id}`);
    revalidatePath('/products');
    return updatedProduct || null;
  } catch (error) {
    console.error('Error updating product:', error);
    throw new Error('No se pudo actualizar el producto');
  }
}

// Eliminar un producto
export async function deleteProduct(id: number): Promise<boolean> {
  try {
    const [deletedProduct] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });
    
    revalidatePath('/products');
    return !!deletedProduct;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw new Error('No se pudo eliminar el producto');
  }
}

// Obtener productos destacados
export async function getFeaturedProducts(limit: number = 5): Promise<Product[]> {
  try {
    return await db
      .select()
      .from(products)
      .where(eq(products.destacado, true))
      .limit(limit)
      .orderBy(desc(products.created_at));
  } catch (error) {
    console.error('Error fetching featured products:', error);
    throw new Error('No se pudieron obtener los productos destacados');
  }
}