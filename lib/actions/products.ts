'use server';

import { db } from '../db';
import { products, orderItems, categories, mercadolibreProductsSync } from '../schema';
import { and, eq, desc, sql, gte, lte, like, asc } from 'drizzle-orm';
import type { NewProduct, Product } from '../schema';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ProductFilters } from '@/types';
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';
import { validateProductForMercadoLibre } from '@/lib/validations/mercadolibre';

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
    // Resolver categoría a partir de mlCategoryId (fuente principal) o categoryId como respaldo
    let categoryId: number | undefined
    let categoryName: string | undefined

    if (productData.mlCategoryId) {
      const category = await db.query.categories.findFirst({
        where: eq(categories.mlCategoryId, productData.mlCategoryId),
      })

      if (!category) {
        throw new Error('Categoría de Mercado Libre no encontrada')
      }

      categoryId = category.id
      categoryName = category.name
    } else if (productData.categoryId != null) {
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, productData.categoryId),
      })

      if (!category) {
        throw new Error('Categoría no encontrada')
      }

      categoryId = category.id
      categoryName = category.name
    }

    const [updatedProduct] = await db
      .update(products)
      .set({
        ...productData,
        ...(categoryId != null && { categoryId }),
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
    // Resolver categoría usando mlCategoryId como fuente principal
    const category = await db.query.categories.findFirst({
      where: eq(categories.mlCategoryId, productData.mlCategoryId!),
    })

    if (!category) {
      throw new Error('Categoría de Mercado Libre no encontrada')
    }

    const [newProduct] = await db
      .insert(products)
      .values({
        ...productData,
        categoryId: category.id,
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
    // Resolver categoría a partir de mlCategoryId (fuente principal) o categoryId como respaldo
    let categoryId: number | undefined
    let categoryName: string | undefined

    if (productData.mlCategoryId) {
      const category = await db.query.categories.findFirst({
        where: eq(categories.mlCategoryId, productData.mlCategoryId),
      })

      if (!category) {
        throw new Error('Categoría de Mercado Libre no encontrada')
      }

      categoryId = category.id
      categoryName = category.name
    } else if (productData.categoryId != null) {
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, productData.categoryId),
      })

      if (!category) {
        throw new Error('Categoría no encontrada')
      }

      categoryId = category.id
      categoryName = category.name
    }

    const [updatedProduct] = await db
      .update(products)
      .set({
        ...productData,
        ...(categoryId != null && { categoryId }),
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

// ======================
// Funciones para Mercado Libre
// ======================

// Sincronizar producto con Mercado Libre (integrado con cola y validaciones)
export async function syncProductToMercadoLibre(
  productId: number,
  userId: number,
  retryCount: number = 0
): Promise<{ success: boolean; mlItemId?: string; error?: string }> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = process.env.NODE_ENV === 'test' ? 10 : 1000; // 1 segundo

  try {
    // Obtener producto local
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      return { success: false, error: 'Producto no encontrado' };
    }

    // Validar producto para Mercado Libre
    const validation = validateProductForMercadoLibre(product);
    
    if (!validation.valid) {
      const errorMessage = `Validación fallida: ${validation.errors.join(', ')}`;
      
      logger.error('Products: Validación de producto fallida', {
        productId,
        productName: product.name,
        errors: validation.errors,
        warnings: validation.warnings
      });
      
      // Actualizar estado de error en la tabla de cola
      await db.update(mercadolibreProductsSync)
        .set({
          syncStatus: 'error',
          syncError: errorMessage,
          updatedAt: new Date()
        })
        .where(eq(mercadolibreProductsSync.productId, productId));

      // También actualizar el producto local
      await db.update(products)
        .set({
          mlSyncStatus: 'error',
          updated_at: new Date()
        })
        .where(eq(products.id, productId));

      return { success: false, error: errorMessage };
    }

    // Log warnings si existen
    if (validation.warnings.length > 0) {
      logger.warn('Products: Advertencias de validación', {
        productId,
        productName: product.name,
        warnings: validation.warnings
      });
    }

    // Validaciones de negocio (mantener las existentes como respaldo)
    if (product.stock <= 0) {
      return { success: false, error: 'stock insuficiente' };
    }

    if (isNaN(Number(product.price)) || Number(product.price) <= 0) {
      return { success: false, error: 'precio inválido' };
    }

    // Actualizar estado de sincronización en la tabla de cola
    await db.update(mercadolibreProductsSync)
      .set({ 
        syncStatus: 'syncing',
        syncAttempts: sql`${mercadolibreProductsSync.syncAttempts} + 1`,
        updatedAt: new Date()
      })
      .where(eq(mercadolibreProductsSync.productId, productId));

    logger.info('Products: Iniciando sincronización con ML', {
      productId,
      productName: product.name,
      userId,
      attempt: retryCount + 1,
      validationPassed: true
    });

    // Preparar datos para ML (usando datos validados)
    const mlProductData = {
      title: product.name,
      category_id: product.mlCategoryId || 'MLA3530', // Default categoría
      price: Number(product.price),
      currency_id: product.mlCurrencyId || 'ARS',
      available_quantity: product.stock,
      buying_mode: product.mlBuyingMode || 'buy_it_now',
      listing_type_id: product.mlListingTypeId || 'bronze',
      condition: product.mlCondition || 'new',
      description: product.description || '',
      pictures: product.images ? 
        (Array.isArray(product.images) ? product.images.map(img => ({ source: img })) : [{ source: product.image }]) :
        [{ source: product.image }].filter(img => img.source),
    };

    // Enviar a Mercado Libre
    const response = await makeAuthenticatedRequest(
      userId,
      '/items',
      {
        method: 'POST',
        body: JSON.stringify(mlProductData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      
      // Verificar si es un error temporal que debe reintentarse
      if (errorText.includes('temporarily unavailable') && retryCount < MAX_RETRIES) {
        logger.warn('Products: Error temporal, reintentando', {
          productId,
          attempt: retryCount + 1,
          maxRetries: MAX_RETRIES,
          error: errorText
        });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
        return syncProductToMercadoLibre(productId, userId, retryCount + 1);
      }
      
      throw new Error(`Error creando producto en ML: ${errorText}`);
    }

    const mlItem = await response.json();
    const mlItemId = mlItem.id;

    logger.info('Products: Producto creado exitosamente en ML', {
      productId,
      mlItemId,
      mlPermalink: mlItem.permalink
    });

    // Actualizar producto local con ID de ML
    await db.update(products)
      .set({
        mlItemId,
        mlSyncStatus: 'synced',
        mlLastSync: new Date(),
        mlPermalink: mlItem.permalink,
        mlThumbnail: mlItem.thumbnail,
        updated_at: new Date()
      })
      .where(eq(products.id, productId));

    // Actualizar tabla de sincronización (cola)
    await db.update(mercadolibreProductsSync)
      .set({
        mlItemId,
        syncStatus: 'synced',
        lastSyncAt: new Date(),
        mlData: mlItem,
        syncError: null,
        updatedAt: new Date()
      })
      .where(eq(mercadolibreProductsSync.productId, productId));

    return { success: true, mlItemId };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Products: Error sincronizando producto a ML', {
      productId,
      userId,
      attempt: retryCount + 1,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Verificar si alcanzó el máximo de reintentos
    if (retryCount >= MAX_RETRIES) {
      const errorMsg = 'máximo de reintentos alcanzado';
      
      // Actualizar estado de error en la tabla de cola
      await db.update(mercadolibreProductsSync)
        .set({
          syncStatus: 'error',
          syncError: errorMsg,
          updatedAt: new Date()
        })
        .where(eq(mercadolibreProductsSync.productId, productId));

      // También actualizar el producto local
      await db.update(products)
        .set({
          mlSyncStatus: 'error',
          updated_at: new Date()
        })
        .where(eq(products.id, productId));

      return { success: false, error: errorMsg };
    }
    
    // Para errores temporales, reintentar automáticamente
    if (errorMessage.includes('temporarily unavailable')) {
      logger.info('Products: Reintentando automáticamente', {
        productId,
        attempt: retryCount + 1,
        maxRetries: MAX_RETRIES
      });
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
      return syncProductToMercadoLibre(productId, userId, retryCount + 1);
    }
    
    // Actualizar estado de error en la tabla de cola
    await db.update(mercadolibreProductsSync)
      .set({
        syncStatus: 'error',
        syncError: errorMessage,
        updatedAt: new Date()
      })
      .where(eq(mercadolibreProductsSync.productId, productId));

    // También actualizar el producto local
    await db.update(products)
      .set({
        mlSyncStatus: 'error',
        updated_at: new Date()
      })
      .where(eq(products.id, productId));

    return { 
      success: false, 
      error: errorMessage
    };
  }
}

// Actualizar stock en Mercado Libre
export async function updateStockInMercadoLibre(
  productId: number,
  newStock: number,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product?.mlItemId) {
      return { success: false, error: 'Producto no sincronizado con ML' };
    }

    const response = await makeAuthenticatedRequest(
      userId,
      `/items/${product.mlItemId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          available_quantity: newStock,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error actualizando stock en ML: ${error}`);
    }

    // Actualizar timestamp de sincronización
    await db.update(products)
      .set({
        mlLastSync: new Date(),
        updated_at: new Date()
      })
      .where(eq(products.id, productId));

    return { success: true };

  } catch (error) {
    console.error('Error actualizando stock en ML:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Obtener productos pendientes de sincronización
export async function getPendingSyncProducts() {
  return await db.query.products.findMany({
    where: eq(products.mlSyncStatus, 'pending'),
    orderBy: desc(products.created_at),
  });
}

// Crear registro de sincronización para producto
export async function createProductSyncRecord(productId: number) {
  const existing = await db.query.mercadolibreProductsSync.findFirst({
    where: eq(mercadolibreProductsSync.productId, productId),
  });

  if (!existing) {
    await db.insert(mercadolibreProductsSync).values({
      productId,
      syncStatus: 'pending',
    });
    
    logger.info('Products: Registro de sincronización creado', { productId });
  } else {
    logger.info('Products: Registro de sincronización ya existe', { 
      productId, 
      currentStatus: existing.syncStatus 
    });
  }
}

// Agregar producto a la cola de sincronización
export async function addProductToSyncQueue(
  productId: number, 
  priority: 'low' | 'normal' | 'high' | 'critical' = 'normal',
  delayMinutes: number = 0
) {
  try {
    const { addToSyncQueue } = await import('@/lib/queue/sync-queue');
    
    await addToSyncQueue(productId, priority, delayMinutes);
    
    logger.info('Products: Producto agregado a cola de sincronización', {
      productId,
      priority,
      delayMinutes
    });
    
    return { success: true };
  } catch (error) {
    logger.error('Products: Error agregando producto a cola', {
      productId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Sincronizar múltiples productos en lote
export async function syncMultipleProducts(
  productIds: number[],
  userId: number
): Promise<{ success: boolean; results: { processed: number; successful: number; failed: number; }; error?: string }> {
  try {
    const { processBatch } = await import('@/lib/queue/sync-queue');
    
    // Agregar todos los productos a la cola primero
    for (const productId of productIds) {
      await addProductToSyncQueue(productId, 'normal', 0);
    }
    
    // Procesar el lote
    const results = await processBatch(userId);
    
    logger.info('Products: Sincronización en lote completada', {
      userId,
      productCount: productIds.length,
      ...results
    });
    
    return { 
      success: true, 
      results 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Products: Error en sincronización en lote', {
      userId,
      productIds,
      error: errorMessage
    });
    
    return { 
      success: false, 
      error: errorMessage,
      results: { processed: 0, successful: 0, failed: 0 }
    };
  }
}
