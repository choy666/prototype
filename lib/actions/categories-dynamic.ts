/**
 * Obtener categorías de Mercado Libre dinámicamente desde la API
 * Reemplaza el array hardcodeado ML_CATEGORY_IDS
 */

import { getApiUrl, getMercadoLibreConfig } from '@/lib/config/integrations';
import { logger } from '@/lib/utils/logger';

interface MLCategory {
  id: string;
  items: { id: string; name: string }[];
  name: string;
  path_from_root: Array<{ id: string; name: string }>;
  children_categories: Array<{ id: string; name: string }>;
  settings: {
    buying_allowed: boolean;
    selling_allowed: boolean;
  };
}

/**
 * Obtiene todas las categorías raíz de un site
 */
export async function getRootCategories(accessToken: string): Promise<MLCategory[]> {
  const mlConfig = getMercadoLibreConfig();
  const url = getApiUrl('mercadolibre', '/sites/{site_id}/categories', { site_id: mlConfig.siteId });
  
  logger.info('Fetching root categories from ML API', { siteId: mlConfig.siteId });
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Error fetching root categories', { status: response.status, error });
    throw new Error(`Error ${response.status}: ${error}`);
  }

  const categories: MLCategory[] = await response.json();
  logger.info(`Retrieved ${categories.length} root categories`);
  
  return categories;
}

/**
 * Obtiene categorías populares basadas en volumen de ventas
 * Usa el endpoint de trends de ML si está disponible
 */
export async function getPopularCategories(accessToken: string, limit: number = 30): Promise<MLCategory[]> {
  const mlConfig = getMercadoLibreConfig();
  
  // Intentar obtener desde trends si está disponible
  try {
    const url = getApiUrl('mercadolibre', '/sites/{site_id}/trends/search', { site_id: mlConfig.siteId });
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const trends = await response.json();
      // Extraer categorías únicas de los trends
      const categoryIds = [...new Set(trends.map((item: { category_id: string }) => item.category_id))];
      
      // Obtener detalles de cada categoría
      const categories = await Promise.all(
        (categoryIds as string[]).map(async (id: string) => {
          const categoryUrl = getApiUrl('mercadolibre', '/categories/{category_id}', { category_id: id });
          const catResponse = await fetch(categoryUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          return catResponse.ok ? catResponse.json() : null;
        })
      );
      
      return categories.filter(Boolean).slice(0, limit);
    }
  } catch (error) {
    logger.warn('Could not fetch trends, falling back to root categories', { error });
  }

  // Fallback: obtener categorías raíz y filtrar las principales
  const rootCategories = await getRootCategories(accessToken);
  
  // Filtrar categorías que permiten comprar y vender
  const validCategories = rootCategories.filter(cat => 
    cat.settings.buying_allowed && 
    cat.settings.selling_allowed
  );

  // Ordenar por nombre y tomar las primeras N
  return validCategories
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * Obtiene categorías por nivel de profundidad
 */
export async function getCategoriesByLevel(
  accessToken: string, 
  maxLevel: number = 2,
  limit: number = 30
): Promise<MLCategory[]> {
  const rootCategories = await getRootCategories(accessToken);
  const result: MLCategory[] = [];

  for (const category of rootCategories) {
    if (result.length >= limit) break;
    
    // Incluir categorías hoja del nivel actual
    if (!category.children_categories || category.children_categories.length === 0) {
      result.push(category);
      continue;
    }

    // Si no estamos en el nivel máximo, incluir hijos
    if (maxLevel > 1) {
      const children = await Promise.all(
        category.children_categories.slice(0, 5).map(async (child) => {
          const url = getApiUrl('mercadolibre', '/categories/{category_id}', { category_id: child.id });
          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          return response.ok ? response.json() : null;
        })
      );
      
      result.push(...children.filter(Boolean));
    }
  }

  return result.slice(0, limit);
}

/**
 * Obtiene categorías específicas configuradas en variables de entorno
 * Permite mantener control manual sobre qué categorías sincronizar
 */
export async function getConfiguredCategories(accessToken: string): Promise<string[]> {
  const envCategories = process.env.ML_SYNC_CATEGORY_IDS;
  
  if (!envCategories) {
    // Si no hay configuración, usar populares
    const popular = await getPopularCategories(accessToken);
    return popular.map((cat: MLCategory) => cat.id);
  }

  // Usar categorías configuradas
  return envCategories.split(',').map(id => id.trim()).filter(Boolean);
}

/**
 * Filtra categorías que son compatibles con ME2
 */
export async function filterME2CompatibleCategories(
  categories: MLCategory[],
  accessToken: string
): Promise<MLCategory[]> {
  const compatible: MLCategory[] = [];
  
  for (const category of categories) {
    try {
      // Obtener atributos de la categoría
      const url = getApiUrl('mercadolibre', '/categories/{category_id}/attributes', { 
        category_id: category.id 
      });
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (!response.ok) continue;
      
      const attributes = await response.json();
      
      // Verificar atributos requeridos para ME2
      const requiredAttrs = ['weight', 'height', 'width', 'length'];
      const hasRequiredAttrs = requiredAttrs.some(req =>
        attributes.some((attr: { id: string; tags?: { required?: string } }) => 
          attr.id.toLowerCase().includes(req) && 
          attr.tags?.required
        )
      );
      
      if (hasRequiredAttrs) {
        compatible.push(category);
      } else {
        logger.info('Category not ME2 compatible', { 
          categoryId: category.id, 
          name: category.name 
        });
      }
    } catch (error) {
      logger.warn('Error checking category compatibility', { 
        categoryId: category.id, 
        error 
      });
    }
  }
  
  return compatible;
}
