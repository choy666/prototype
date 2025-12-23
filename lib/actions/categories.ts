'use server';

import { db } from '@/lib/db';
import { categories } from '@/lib/schema';
import { eq, and, notInArray, like, desc } from 'drizzle-orm';
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { logger } from '@/lib/utils/logger';
import { getConfiguredCategories } from './categories-dynamic';
import { retryWithBackoff } from '@/lib/utils/retry';
import { revalidatePath } from 'next/cache';

// Tipos para categorías
interface Category {
  id: number;
  name: string;
  description: string | null;
  mlCategoryId: string | null;
  isMlOfficial: boolean;
  isLeaf: boolean;
  attributes?: unknown;
  created_at?: Date;
  updated_at?: Date;
}

interface NewCategory {
  name: string;
  description?: string | null;
  mlCategoryId: string | null;
  isMlOfficial: boolean;
  isLeaf: boolean;
  attributes?: unknown;
}

// Interfaz para caché de categorías ML
interface MLCategoryCache {
  data: Map<string, {
    id: string;
    name: string;
    attributes: Array<{ id: string; tags: string[]; valueType?: string }>;
    isLeaf: boolean;
    children_categories?: Array<{ id: string; name: string }>;
  }>;
  timestamp: number;
  ttl: number;
}

// Inicializar caché global si no existe
declare global {
  var _mlCategoriesCache: MLCategoryCache | undefined;
}

// Configuración de caché (1 hora)
const CACHE_TTL = 60 * 60 * 1000; // 1 hora en milisegundos

// Obtener caché de categorías o inicializarlo
function getCategoriesCache(): MLCategoryCache {
  if (!globalThis._mlCategoriesCache) {
    globalThis._mlCategoriesCache = {
      data: new Map(),
      timestamp: 0,
      ttl: CACHE_TTL
    };
  }
  return globalThis._mlCategoriesCache;
}

// Verificar si el caché está vigente
function isCacheValid(cache: MLCategoryCache): boolean {
  return Date.now() - cache.timestamp < cache.ttl;
}

// Obtener categoría del caché o fetch desde ML
async function getMLCategoryWithAttributes(categoryId: string, accessToken: string): Promise<{
  id: string;
  name: string;
  attributes: Array<{ id: string; tags: string[]; valueType?: string }>;
  isLeaf: boolean;
  children_categories?: Array<{ id: string; name: string }>;
}> {
  // Verificar caché primero
  const cache = getCategoriesCache();
  if (isCacheValid(cache) && cache.data.has(categoryId)) {
    logger.info('[ML Categories] Cache hit para categoría', { categoryId });
    return cache.data.get(categoryId)!;
  }

  logger.info('[ML Categories] Cache miss, fetch desde API ML', { categoryId });

  // Obtener detalles básicos de la categoría
  const detailUrl = `https://api.mercadolibre.com/categories/${categoryId}`;
  const detailResponse = await retryWithBackoff(async () => {
    const response = await fetch(detailUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new MercadoLibreError(
          MercadoLibreErrorCode.AUTH_FAILED,
          'Token de ML caducado durante fetch de categoría',
          { status: response.status, categoryId }
        );
      }
      if (response.status === 429) {
        throw new MercadoLibreError(
          MercadoLibreErrorCode.API_RATE_LIMIT_EXCEEDED,
          'Rate limit de ML durante fetch de categoría',
          { status: response.status, categoryId }
        );
      }
      throw new MercadoLibreError(
        MercadoLibreErrorCode.CATEGORY_NOT_FOUND,
        `Categoría ${categoryId} no encontrada en ML`,
        { status: response.status, categoryId }
      );
    }

    return response;
  }, {
    maxRetries: 3,
    shouldRetry: (error: unknown) => {
      return error instanceof MercadoLibreError && 
             (error.code === MercadoLibreErrorCode.CONNECTION_ERROR ||
              error.code === MercadoLibreErrorCode.TIMEOUT_ERROR ||
              error.code === MercadoLibreErrorCode.API_RATE_LIMIT_EXCEEDED);
    }
  });

  const details = await detailResponse.json();

  // Obtener atributos de la categoría
  const attributesUrl = `https://api.mercadolibre.com/categories/${categoryId}/attributes`;
  const attributesResponse = await retryWithBackoff(async () => {
    const response = await fetch(attributesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      logger.warn('[ML Categories] No se pudieron obtener atributos', {
        categoryId,
        status: response.status
      });
      // Retornar array vacío si falla el fetch de atributos
      return { ok: true, json: async () => ({}) };
    }

    return response;
  }, {
    maxRetries: 2,
    shouldRetry: (error: unknown) => {
      return error instanceof MercadoLibreError && 
             (error.code === MercadoLibreErrorCode.CONNECTION_ERROR ||
              error.code === MercadoLibreErrorCode.TIMEOUT_ERROR);
    }
  });

  const attributesData = await attributesResponse.json();
  const attributes = Array.isArray(attributesData) 
    ? attributesData.map((attr: { id: string; tags?: string[]; value_type?: string }) => ({
        id: attr.id,
        tags: attr.tags || [],
        valueType: attr.value_type
      }))
    : [];

  // Validar que tenga al menos 3 atributos obligatorios para ME2
  const requiredAttributes = ['weight', 'height', 'width', 'length'];
  const hasRequiredAttributes = requiredAttributes.some(req => 
    attributes.some(attr => attr.id.toLowerCase().includes(req))
  );

  if (!hasRequiredAttributes) {
    logger.warn('[ML Categories] Categoría con atributos insuficientes para ME2', {
      categoryId,
      categoryName: details.name,
      attributes: attributes.slice(0, 10),
      requiredAttributes
    });
  }

  const categoryData = {
    id: details.id,
    name: details.name,
    attributes,
    isLeaf: !details.children_categories || details.children_categories.length === 0,
    children_categories: details.children_categories
  };

  // Guardar en caché
  cache.data.set(categoryId, categoryData);
  cache.timestamp = Date.now();

  logger.info('[ML Categories] Categoría guardada en caché', {
    categoryId,
    attributesCount: attributes.length,
    hasRequiredAttributes,
    isLeaf: categoryData.isLeaf
  });

  return categoryData;
}

// Obtener todas las categorías (solo categorías hoja para productos)
export async function getCategories(search?: string, onlyLeaf: boolean = true): Promise<Category[]> {
  try {
    // Construir condiciones dinámicamente sin reasignar el query
    const conditions = []
    
    if (search) {
      conditions.push(like(categories.name, `%${search}%`))
    }
    
    // Filtrar solo categorías hoja (se pueden usar para publicar productos)
    if (onlyLeaf) {
      conditions.push(eq(categories.isLeaf, true))
    }
    
    // Aplicar where condicionalmente sin reasignación
    const query = db.select().from(categories)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(categories.created_at))
    
    return await query
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw new Error('No se pudieron obtener las categorías');
  }
}

// Obtener categoría por ID
export async function getCategoryById(id: number): Promise<Category | null> {
  try {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || null;
  } catch (error) {
    console.error('Error fetching category by id:', error);
    throw new Error('No se pudo obtener la categoría');
  }
}

// Crear categoría
export async function createCategory(
  categoryData: Omit<NewCategory, 'id' | 'created_at' | 'updated_at'>
): Promise<Category> {
  try {
    const [newCategory] = await db
      .insert(categories)
      .values({
        ...categoryData,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    revalidatePath('/admin/categories');
    return newCategory;
  } catch (error) {
    console.error('Error creating category:', error);
    throw new Error('No se pudo crear la categoría');
  }
}

// Sincronizar las categorías oficiales de Mercado Libre con caché y validación ME2
export async function syncMLCategories(): Promise<{
  created: number;
  updated: number;
  errors: number;
  totalCategories: number;
  cacheHits: number;
  warnings: string[];
}> {
  try {
    logger.info('[ML Categories] Iniciando sincronización con caché y validación ME2');
    
    // Obtener token de acceso de Mercado Libre con retry
    const mlAuth = await MercadoLibreAuth.getInstance();
    const accessToken = await mlAuth.getAccessToken();
    
    if (!accessToken) {
      throw new MercadoLibreError(
        MercadoLibreErrorCode.AUTH_FAILED,
        'No se pudo obtener el token de acceso de Mercado Libre'
      );
    }
    
    // Obtener categorías dinámicamente (configuradas o populares)
    const categoryIds = await getConfiguredCategories(accessToken);
    
    const syncResults = { 
      created: 0, 
      updated: 0, 
      errors: 0, 
      cacheHits: 0,
      warnings: [] as string[]
    };
    
    for (const categoryId of categoryIds) {
      try {
        // Obtener categoría con atributos (usando caché)
        const categoryData = await getMLCategoryWithAttributes(categoryId, accessToken);
        
        // Verificar si fue un cache hit
        const cache = getCategoriesCache();
        const wasCached = isCacheValid(cache) && cache.data.has(categoryId);
        if (wasCached) {
          syncResults.cacheHits++;
        }
        
        // Validar atributos ME2
        const requiredAttributes = ['weight', 'height', 'width', 'length'];
        const hasRequiredAttributes = requiredAttributes.some(req => 
          categoryData.attributes.some(attr => attr.id.toLowerCase().includes(req))
        );
        
        if (!hasRequiredAttributes && categoryData.isLeaf) {
          syncResults.warnings.push(
            `⚠️ Categoría ${categoryData.name} (${categoryId}) no tiene atributos suficientes para ME2`
          );
        }
        
        // Insertar o actualizar en BD
        const existing = await db
          .select()
          .from(categories)
          .where(eq(categories.mlCategoryId, categoryId))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(categories).values({
            name: categoryData.name,
            mlCategoryId: categoryId,
            isMlOfficial: true,
            isLeaf: categoryData.isLeaf,
            attributes: categoryData.attributes,
            created_at: new Date(),
            updated_at: new Date(),
          });
          syncResults.created++;
          logger.info('[ML Categories] ✅ Categoría creada', {
            categoryId,
            categoryName: categoryData.name,
            isLeaf: categoryData.isLeaf,
            hasRequiredAttributes,
            fromCache: wasCached
          });
        } else {
          // Actualizar categorías existentes
          await db.update(categories)
            .set({
              name: categoryData.name,
              isMlOfficial: true,
              isLeaf: categoryData.isLeaf,
              attributes: categoryData.attributes,
              updated_at: new Date()
            })
            .where(eq(categories.mlCategoryId, categoryId));
          syncResults.updated++;
          logger.info('[ML Categories] 🔄 Categoría actualizada', {
            categoryId,
            categoryName: categoryData.name,
            isLeaf: categoryData.isLeaf,
            hasRequiredAttributes,
            fromCache: wasCached
          });
        }
        
        // Delay más corto si usamos caché para evitar rate limiting innecesario
        await new Promise(resolve => setTimeout(resolve, wasCached ? 50 : 150));
        
      } catch (error) {
        // Manejo específico de errores de autenticación
        if (error instanceof MercadoLibreError && error.code === MercadoLibreErrorCode.AUTH_FAILED) {
          logger.warn('[ML Categories] Intentando refrescar token', { categoryId });
          
          try {
            // Intentar refrescar el token - necesitamos obtener el usuario actual
            // Por ahora, vamos a simplificar y lanzar error para que se reintente más tarde
            throw new MercadoLibreError(
              MercadoLibreErrorCode.AUTH_FAILED,
              'Token de ML caducado - reintente más tarde',
              { categoryId }
            );
            
          } catch (refreshError) {
            logger.error('[ML Categories] ❌ Error refrescando token', {
              categoryId,
              error: refreshError instanceof Error ? refreshError.message : String(refreshError)
            });
            syncResults.errors++;
            syncResults.warnings.push(
              `❌ Error de autenticación para categoría ${categoryId} (token no se pudo refrescar)`
            );
          }
        } else {
          logger.error('[ML Categories] ❌ Error sincronizando categoría', {
            categoryId,
            error: error instanceof Error ? error.message : String(error),
            errorType: error instanceof MercadoLibreError ? error.code : 'UNKNOWN'
          });
          syncResults.errors++;
          syncResults.warnings.push(
            `❌ Error sincronizando categoría ${categoryId}: ${error instanceof Error ? error.message : 'Error desconocido'}`
          );
        }
      }
    }
    
    // Asegurar que solo las categorías de la lista fija queden marcadas como hoja y oficiales de ML
    await db.update(categories)
      .set({
        isLeaf: false,
        isMlOfficial: false,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(categories.isMlOfficial, true),
          notInArray(categories.mlCategoryId, categoryIds)
        )
      );
    
    // Limpiar caché antiguo si es necesario
    const cache = getCategoriesCache();
    const cacheSize = cache.data.size;
    if (cacheSize > 100) { // Limitar tamaño de caché
      logger.warn('[ML Categories] Limpiando caché por tamaño excesivo', { cacheSize });
      cache.data.clear();
      cache.timestamp = 0;
    }
    
    revalidatePath('/admin/categories');
    
    const result = {
      ...syncResults,
      totalCategories: categoryIds.length
    };
    
    logger.info('[ML Categories] ✅ Sincronización completada', {
      created: result.created,
      updated: result.updated,
      errors: result.errors,
      cacheHits: result.cacheHits,
      warningsCount: result.warnings.length,
      totalCategories: result.totalCategories
    });
    
    return result;
    
  } catch (error) {
    logger.error('[ML Categories] ❌ Error crítico en sincronización', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    throw new MercadoLibreError(
      MercadoLibreErrorCode.SYNC_FAILED,
      'Error al sincronizar categorías de Mercado Libre',
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

// Actualizar categoría
export async function updateCategory(
  id: number,
  categoryData: Partial<Omit<NewCategory, 'id' | 'created_at'>>
): Promise<Category | null> {
  try {
    const [updatedCategory] = await db
      .update(categories)
      .set({
        ...categoryData,
        updated_at: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();

    revalidatePath(`/admin/categories/${id}`);
    revalidatePath('/admin/categories');
    return updatedCategory || null;
  } catch (error) {
    console.error('Error updating category:', error);
    throw new Error('No se pudo actualizar la categoría');
  }
}

// Eliminar categoría
export async function deleteCategory(id: number): Promise<boolean> {
  try {
    const [deletedCategory] = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });

    revalidatePath('/admin/categories');
    return !!deletedCategory;
  } catch (error) {
    console.error('Error deleting category:', error);
    throw new Error('No se pudo eliminar la categoría');
  }
}
