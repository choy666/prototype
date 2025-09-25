// En lib/actions/products.ts
'use server';

import { db } from '../db';
import { products } from '../schema';
import { and, eq, desc, sql, gte, lte, like, asc } from 'drizzle-orm';
import type { NewProduct, Product } from '../schema';
import { revalidatePath } from 'next/cache';

// Actualizar el tipo ProductFilters
type ProductFilters = {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: 'name' | 'price' | 'category' | 'created_at' | 'updated_at' | 'stock';
  sortOrder?: 'asc' | 'desc';
};

// Obtener productos con paginación y filtros
export async function getProducts(
  page = 1, 
  limit = 10,
  filters: ProductFilters = {}
) {
  try {
    const offset = (page - 1) * limit;
    const { category, minPrice, maxPrice, search, sortBy = 'created_at', sortOrder = 'desc' } = filters;
    
    // Construir condiciones de filtro
    const conditions = [];
    if (category) conditions.push(eq(products.category, category));
    if (minPrice !== undefined) conditions.push(gte(products.price, minPrice.toString()));
    if (maxPrice !== undefined) conditions.push(lte(products.price, maxPrice.toString()));
    if (search) conditions.push(like(products.name, `%${search}%`));

    // Obtener datos con filtros
    const data = await db.query.products.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: (sortOrder === 'desc' ? desc : asc)(
        products[sortBy as 'name' | 'price' | 'category' | 'created_at' | 'updated_at' | 'stock']
      ),
      limit,
      offset,
    });

    // Contar total de productos con los mismos filtros
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const count = countResult[0]?.count || 0;

    return {
      data,
      pagination: {
        total: Number(count),
        page,
        limit,
        totalPages: Math.ceil(Number(count) / limit),
      },
      filters: {
        ...filters,
        sortBy,
        sortOrder,
      }
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    throw new Error('Failed to fetch products');
  }
}

// Obtener un producto por ID
export async function getProductById(id: number): Promise<Product | null> {
  try {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || null;
  } catch (error) {
    console.error('Error fetching product by id:', error);
    throw new Error('Failed to fetch product');
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
    console.error('Error fetching categories:', error);
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
    throw new Error('Failed to create product');
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
    throw new Error('Failed to update product');
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
    throw new Error('Failed to delete product');
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
    return [];
  }
}