'use server';

import { db } from '../db';
import { products, orderItems, categories } from '../schema';
import { and, eq, desc, sql, gte, lte, like, asc } from 'drizzle-orm';
import type { NewProduct, Product } from '../schema';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ProductFilters } from '@/types';

// ✅ Esquema de validación para los filtros de productos
const productFiltersSchema = z.object({
  category: z
    .string()
    .optional()
    .refine(val => val !== 'all', {
      message: 'El valor "all" no es válido como categoría',
    }),
  minPrice: z.preprocess(
    v => (v === '' || v === null ? undefined : v),
    z.coerce.number().min(0).optional()
  ),
  maxPrice: z.preprocess(
    v => (v === '' || v === null ? undefined : v),
    z.coerce.number().min(0).optional()
  ),
  minStock: z.preprocess(
    v => (v === '' || v === null ? undefined : v),
    z.coerce.number().min(0).optional()
  ),
  maxStock: z.preprocess(
    v => (v === '' || v === null ? undefined : v),
    z.coerce.number().min(0).optional()
  ),
  minDiscount: z.coerce.number().min(0).max(100).optional(),
  featured: z.boolean().optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(['name', 'price', 'category', 'created_at', 'updated_at', 'stock', 'discount'])
    .default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ✅ Obtener productos con paginación y filtros
export async function getProducts(
  page = 1,
  limit = 10,
  filters: Partial<ProductFilters> = {},
  includeInactive = false
) {
  try {
    const validatedPage = z.coerce.number().int().min(1).default(1).parse(page);
    const validatedLimit = z.coerce.number().int().min(1).default(10).parse(limit);
    const validatedFilters = productFiltersSchema.parse(filters);

    const offset = (validatedPage - 1) * validatedLimit;
    const {
      category,
      minPrice,
      maxPrice,
      minStock,
      maxStock,
      minDiscount,
      featured,
      search,
      sortBy,
      sortOrder,
    } = validatedFilters;

    // Construir condiciones de filtro
    const conditions = [];
    if (!includeInactive) {
      conditions.push(eq(products.isActive, true)); // Para tienda, solo productos activos
    }
    if (category) {
      conditions.push(eq(products.category, category));
    }
    if (typeof minPrice === 'number') {
      conditions.push(gte(products.price, String(minPrice)));
    }
    if (typeof maxPrice === 'number') {
      conditions.push(lte(products.price, String(maxPrice)));
    }
    if (typeof minStock === 'number') {
      conditions.push(gte(products.stock, minStock));
    }
    if (typeof maxStock === 'number') {
      conditions.push(lte(products.stock, maxStock));
    }
    if (typeof minDiscount === 'number') {
      conditions.push(gte(products.discount, minDiscount));
    }
    if (typeof featured === 'boolean') {
      conditions.push(eq(products.destacado, featured));
    }
    if (search) {
      conditions.push(like(products.name, `%${search}%`));
    }

    // Obtener datos y conteo total en paralelo
    const [data, countResult] = await Promise.all([
      db.query.products.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: (sortOrder === 'desc' ? desc : asc)(products[sortBy]),
        limit: validatedLimit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const count = Number(countResult[0]?.count ?? 0);

    // Normalizar imágenes para cada producto
    const normalizedData = data.map(product => ({
      ...product,
      images: normalizeImages(product.images),
    }));

    return {
      data: normalizedData,
      pagination: {
        total: count,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(count / validatedLimit),
      },
      filters: validatedFilters,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues);
      throw new Error('Parámetros de filtros inválidos');
    }
    console.error('Error fetching products:', error);
    return {
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
      filters: {},
    };
  }
}

// ✅ Función helper para normalizar imágenes
function normalizeImages(images: unknown): string[] {
  if (typeof images === 'string') {
    return images.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
  if (Array.isArray(images)) {
    return images as string[];
  }
  return [];
}

// ✅ Obtener un producto por ID
export async function getProductById(id: number): Promise<Product | null> {
  try {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) return null;

    // Normalizar imágenes para compatibilidad
    const normalizedProduct = {
      ...product,
      images: normalizeImages(product.images),
    };

    return normalizedProduct;
  } catch (error) {
    console.error('Error fetching product by id:', error);
    throw new Error('No se pudieron obtener los productos');
  }
}

// ✅ Actualizar un producto con atributos
export async function updateProductWithAttributes(
  id: number,
  productData: Partial<Omit<NewProduct, 'id' | 'created_at'>>
): Promise<Product | null> {
  try {
    // Si se está actualizando categoryId, obtener el nombre de la categoría
    let categoryName: string | undefined;
    if (productData.categoryId != null) {
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, productData.categoryId),
      });

      if (!category) {
        throw new Error('Categoría no encontrada');
      }

      categoryName = category.name;
    }

    const [updatedProduct] = await db
      .update(products)
      .set({
        ...productData,
        ...(categoryName && { category: categoryName }),
        updated_at: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    revalidatePath(`/products/${id}`);
    revalidatePath('/products');
    return updatedProduct || null;
  } catch (error) {
    console.error('Error updating product with attributes:', error);
    throw new Error('No se pudo actualizar el producto con atributos');
  }
}

// ✅ Obtener categorías únicas
export async function getCategories(): Promise<string[]> {
  try {
    const result = await db
      .select({ category: products.category })
      .from(products)
      .groupBy(products.category);
    return result.map(r => r.category);
  } catch (error) {
    console.error('No se pudieron encontrar los productos:', error);
    return [];
  }
}

// ✅ Crear un nuevo producto
export async function createProduct(
  productData: Omit<NewProduct, 'id' | 'created_at' | 'updated_at' | 'category'>
): Promise<Product> {
  try {
    // Obtener el nombre de la categoría para poblar el campo category
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, productData.categoryId!),
    });

    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    const [newProduct] = await db
      .insert(products)
      .values({
        ...productData,
        category: category.name,
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

// ✅ Actualizar un producto
export async function updateProduct(
  id: number,
  productData: Partial<Omit<NewProduct, 'id' | 'created_at'>>
): Promise<Product | null> {
  try {
    // Si se está actualizando categoryId, obtener el nombre de la categoría
    let categoryName: string | undefined;
    if (productData.categoryId != null) {
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, productData.categoryId),
      });

      if (!category) {
        throw new Error('Categoría no encontrada');
      }

      categoryName = category.name;
    }

    const [updatedProduct] = await db
      .update(products)
      .set({
        ...productData,
        ...(categoryName && { category: categoryName }),
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

// ✅ Eliminar un producto
export async function deleteProduct(id: number): Promise<boolean> {
  try {
    // Verificar si el producto tiene órdenes asociadas
    const orderItemsCount = await db.$count(orderItems, eq(orderItems.productId, id));
    if (orderItemsCount > 0) {
      throw new Error('No se puede eliminar el producto porque tiene órdenes asociadas');
    }

    const [deletedProduct] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });

    revalidatePath('/products');
    return !!deletedProduct;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error; // Re-lanzar el error para que sea manejado en el handler
  }
}

// ✅ Obtener productos destacados
export async function getFeaturedProducts(limit: number = 5): Promise<Product[]> {
  try {
    const productsData = await db
      .select()
      .from(products)
      .where(and(eq(products.destacado, true), eq(products.isActive, true)))
      .limit(limit)
      .orderBy(desc(products.created_at));

    // Normalizar imágenes para cada producto
    return productsData.map(product => ({
      ...product,
      images: normalizeImages(product.images),
    }));
  } catch (error) {
    console.error('Error fetching featured products:', error);
    throw new Error('No se pudieron obtener los productos destacados');
  }
}

// ✅ Obtener todos los productos (sin filtros, sin límite)
export async function getAllProducts(): Promise<Product[]> {
  try {
    const productsData = await db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(desc(products.created_at));

    // Normalizar imágenes para cada producto
    return productsData.map(product => ({
      ...product,
      images: normalizeImages(product.images),
    }));
  } catch (error) {
    console.error('Error fetching all products:', error);
    throw new Error('No se pudieron obtener todos los productos');
  }
}
