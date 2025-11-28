import { logger } from '@/lib/utils/logger';
import { db } from '@/lib/db';
import { categories } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import type { Product, ME2Dimensions } from './me2Validator';

// Cache simple en memoria para dimensiones calculadas
const dimensionsCache = new Map<string, { ts: number; dimensions: ME2Dimensions }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

// Dimensiones por defecto según categoría (configurable)
const CATEGORY_DEFAULT_DIMENSIONS = {
  'electronics': {
    weight: 500,    // gramos
    height: 10,     // cm
    width: 15,      // cm
    length: 5,      // cm
  },
  'clothing': {
    weight: 200,    // gramos
    height: 25,     // cm
    width: 20,      // cm
    length: 5,      // cm
  },
  'home': {
    weight: 1000,   // gramos
    height: 30,     // cm
    width: 25,      // cm
    length: 20,     // cm
  },
  'books': {
    weight: 300,    // gramos
    height: 23,     // cm
    width: 15,      // cm
    length: 3,      // cm
  },
  'default': {
    weight: 500,    // gramos
    height: 10,     // cm
    width: 10,      // cm
    length: 10,     // cm
  },
};

export interface DimensionCalculationResult {
  dimensions: ME2Dimensions;
  source: 'database' | 'cache' | 'heuristic' | 'default';
  warnings: string[];
  usedDefaults: boolean;
}

// Función de cache simple
function getCacheKey(productIds: number[]): string {
  return productIds.sort((a, b) => a - b).join('-');
}

function getFromCache(key: string): ME2Dimensions | null {
  const entry = dimensionsCache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.ts > CACHE_TTL) {
    dimensionsCache.delete(key);
    return null;
  }
  
  return entry.dimensions;
}

function setCache(key: string, dimensions: ME2Dimensions): void {
  dimensionsCache.set(key, {
    ts: Date.now(),
    dimensions,
  });
}

// Obtener dimensiones desde la base de datos
async function getDimensionsFromDB(productIds: number[]): Promise<ME2Dimensions | null> {
  try {
    const dbProducts = await db.query.products.findMany({
      where: (products, { inArray }) => inArray(products.id, productIds),
      columns: {
        id: true,
        weight: true,
        height: true,
        width: true,
        length: true,
        categoryId: true,
      }
    });

    if (dbProducts.length === 0) {
      return null;
    }

    // Verificar si todos los productos tienen dimensiones completas
    const hasCompleteDimensions = dbProducts.every(p => 
      p.weight && p.height && p.width && p.length &&
      Number(p.weight) > 0 && Number(p.height) > 0 && Number(p.width) > 0 && Number(p.length) > 0
    );

    if (!hasCompleteDimensions) {
      return null;
    }

    // Calcular dimensiones totales
    let totalHeight = 0;
    let maxWidth = 0;
    let maxLength = 0;
    let totalWeight = 0;

    for (const product of dbProducts) {
      totalHeight += Number(product.height);
      maxWidth = Math.max(maxWidth, Number(product.width));
      maxLength = Math.max(maxLength, Number(product.length));
      totalWeight += Number(product.weight);
    }

    return {
      height: totalHeight,
      width: maxWidth,
      length: maxLength,
      weight: totalWeight,
    };

  } catch (error) {
    logger.error('[ME2] Dimensions: Error obteniendo dimensiones de BD', {
      productIds,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

// Obtener dimensiones por defecto según categoría
async function getDimensionsByCategory(categoryId: number): Promise<ME2Dimensions> {
  try {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
      columns: {
        name: true,
        attributes: true,
      }
    });

    // Si la categoría tiene atributos personalizados, usarlos
    if (category?.attributes && typeof category.attributes === 'object' && 'defaultDimensions' in category.attributes) {
      logger.info('[ME2] Dimensions: Usando dimensiones personalizadas de categoría', {
        categoryId,
        categoryName: category?.name || 'Unknown'
      });
      return (category.attributes as Record<string, unknown>).defaultDimensions as ME2Dimensions;
    }

    // Determinar tipo de categoría para defaults
    const categoryName = category?.name?.toLowerCase() || '';
    let categoryType = 'default';

    if (categoryName.includes('electr') || categoryName.includes('tech')) {
      categoryType = 'electronics';
    } else if (categoryName.includes('cloth') || categoryName.includes('vest')) {
      categoryType = 'clothing';
    } else if (categoryName.includes('home') || categoryName.includes('casa')) {
      categoryType = 'home';
    } else if (categoryName.includes('book') || categoryName.includes('libr')) {
      categoryType = 'books';
    }

    const defaults = CATEGORY_DEFAULT_DIMENSIONS[categoryType as keyof typeof CATEGORY_DEFAULT_DIMENSIONS];
    
    logger.info('[ME2] Dimensions: Usando dimensiones por defecto de categoría', {
      categoryId,
      categoryName: category?.name || 'Unknown',
      categoryType,
      defaults
    });

    return defaults;

  } catch (error) {
    logger.error('[ME2] Dimensions: Error obteniendo categoría', {
      categoryId,
      error: error instanceof Error ? error.message : String(error)
    });
    return CATEGORY_DEFAULT_DIMENSIONS.default;
  }
}

// Calcular dimensiones usando heurística avanzada
function calculateHeuristicDimensions(products: Product[]): ME2Dimensions {
  const warnings: string[] = [];
  
  // Agrupar productos por características similares
  const productGroups = {
    heavy: products.filter(p => (p.weight || 0) > 1000),
    large: products.filter(p => (p.height || 0) > 30 || (p.width || 0) > 30 || (p.length || 0) > 30),
    small: products.filter(p => (p.weight || 0) <= 1000 && (p.height || 0) <= 30 && (p.width || 0) <= 30 && (p.length || 0) <= 30),
  };

  // Calcular volumen total estimado
  let totalVolume = 0;
  let totalWeight = 0;

  for (const product of products) {
    const weight = product.weight || 500;
    const height = product.height || 10;
    const width = product.width || 10;
    const length = product.length || 10;
    
    totalVolume += height * width * length;
    totalWeight += weight;
  }

  // Optimizar empaquetado: si hay muchos productos pequeños, apilar eficientemente
  let finalHeight = 0;
  let finalWidth = 0;
  let finalLength = 0;

  if (productGroups.small.length > 1) {
    // Para productos pequeños, usar caja compacta
    const smallVolume = productGroups.small.reduce((sum, p) => {
      const h = p.height || 10;
      const w = p.width || 10;
      const l = p.length || 10;
      return sum + (h * w * l);
    }, 0);

    // Calcular dimensiones de caja cúbica optimizada
    const cubeRoot = Math.cbrt(smallVolume * 1.2); // 20% extra para cushioning
    finalHeight = Math.ceil(cubeRoot);
    finalWidth = Math.ceil(cubeRoot);
    finalLength = Math.ceil(cubeRoot);
    
    warnings.push(`Usando empaquetado compacto para ${productGroups.small.length} productos pequeños`);
  } else {
    // Para productos mixtos o grandes, usar dimensiones máximas
    finalHeight = products.reduce((sum, p) => sum + (p.height || 10), 0);
    finalWidth = Math.max(...products.map(p => p.width || 10));
    finalLength = Math.max(...products.map(p => p.length || 10));
  }

  // Ajustar para productos grandes o pesados
  if (productGroups.heavy.length > 0) {
    // Añadir espacio extra para protección
    finalHeight = Math.ceil(finalHeight * 1.3);
    finalWidth = Math.ceil(finalWidth * 1.2);
    finalLength = Math.ceil(finalLength * 1.2);
    warnings.push('Ajustando dimensiones para productos pesados');
  }

  if (productGroups.large.length > 0) {
    // Asegurar espacio mínimo para productos grandes
    finalHeight = Math.max(finalHeight, 35);
    finalWidth = Math.max(finalWidth, 35);
    finalLength = Math.max(finalLength, 35);
    warnings.push('Ajustando dimensiones para productos grandes');
  }

  const dimensions = {
    height: Math.max(finalHeight, 5),
    width: Math.max(finalWidth, 5),
    length: Math.max(finalLength, 5),
    weight: Math.max(totalWeight, 100),
  };

  logger.info('[ME2] Dimensions: Dimensiones calculadas por heurística', {
    productCount: products.length,
    groups: {
      heavy: productGroups.heavy.length,
      large: productGroups.large.length,
      small: productGroups.small.length,
    },
    totalVolume,
    dimensions,
    warnings
  });

  return dimensions;
}

// Función principal para obtener dimensiones validadas
export async function getValidatedME2Dimensions(productIds: number[]): Promise<DimensionCalculationResult> {
  const cacheKey = getCacheKey(productIds);
  const warnings: string[] = [];
  let usedDefaults = false;

  // 1. Intentar desde cache
  const cachedDimensions = getFromCache(cacheKey);
  if (cachedDimensions) {
    logger.info('[ME2] Dimensions: Usando dimensiones desde cache', {
      productIds,
      cacheKey
    });
    return {
      dimensions: cachedDimensions,
      source: 'cache',
      warnings: [],
      usedDefaults: false,
    };
  }

  // 2. Intentar desde base de datos
  const dbDimensions = await getDimensionsFromDB(productIds);
  if (dbDimensions) {
    setCache(cacheKey, dbDimensions);
    logger.info('[ME2] Dimensions: Dimensiones obtenidas de base de datos', {
      productIds,
      dimensions: dbDimensions
    });
    return {
      dimensions: dbDimensions,
      source: 'database',
      warnings: [],
      usedDefaults: false,
    };
  }

  // 3. Obtener productos para heurística
  const products = await db.query.products.findMany({
    where: (products, { inArray }) => inArray(products.id, productIds),
    columns: {
      id: true,
      name: true,
      weight: true,
      height: true,
      width: true,
      length: true,
      categoryId: true,
    }
  });

  if (products.length === 0) {
    logger.warn('[ME2] Dimensions: No se encontraron productos', { productIds });
    const defaultDimensions = CATEGORY_DEFAULT_DIMENSIONS.default;
    return {
      dimensions: defaultDimensions,
      source: 'default',
      warnings: ['No se encontraron productos, usando dimensiones por defecto'],
      usedDefaults: true,
    };
  }

  // 4. Verificar si podemos usar defaults por categoría
  const hasIncompleteDimensions = products.some(p => 
    !p.weight || !p.height || !p.width || !p.length ||
    Number(p.weight) <= 0 || Number(p.height) <= 0 || Number(p.width) <= 0 || Number(p.length) <= 0
  );

  if (hasIncompleteDimensions) {
    // Intentar usar defaults por categoría si todos los productos son de la misma categoría
    const uniqueCategories = [...new Set(products.map(p => p.categoryId).filter(Boolean))];
    
    if (uniqueCategories.length === 1) {
      const categoryDimensions = await getDimensionsByCategory(uniqueCategories[0]!);
      
      // Aplicar defaults por categoría a productos incompletos
      const mixedProducts = products.map((product: Record<string, unknown>): Product => ({
        id: product.id as number,
        name: product.name as string,
        weight: Number(product.weight) || categoryDimensions.weight,
        height: Number(product.height) || categoryDimensions.height,
        width: Number(product.width) || categoryDimensions.width,
        length: Number(product.length) || categoryDimensions.length,
        shippingMode: product.shippingMode as string || undefined,
        shippingAttributes: product.shippingAttributes as Record<string, unknown> || undefined,
        me2Compatible: product.me2Compatible as boolean || false,
        mlItemId: product.mlItemId as string || undefined,
      }));

      const heuristicDimensions = calculateHeuristicDimensions(mixedProducts);
      setCache(cacheKey, heuristicDimensions);
      
      warnings.push(`${products.filter(p => !p.weight || !p.height || !p.width || !p.length).length} productos con dimensiones incompletas, usando defaults por categoría`);
      
      return {
        dimensions: heuristicDimensions,
        source: 'heuristic',
        warnings,
        usedDefaults: true,
      };
    }
  }

  // 5. Usar heurística avanzada como último recurso
  const heuristicDimensions = calculateHeuristicDimensions(products.map((product: Record<string, unknown>): Product => ({
    id: product.id as number,
    name: product.name as string,
    weight: Number(product.weight) || 500,
    height: Number(product.height) || 10,
    width: Number(product.width) || 10,
    length: Number(product.length) || 10,
    shippingMode: product.shippingMode as string || undefined,
    shippingAttributes: product.shippingAttributes as Record<string, unknown> || undefined,
    me2Compatible: product.me2Compatible as boolean || false,
    mlItemId: product.mlItemId as string || undefined,
  })));

  setCache(cacheKey, heuristicDimensions);

  if (hasIncompleteDimensions) {
    warnings.push(`${products.filter(p => !p.weight || !p.height || !p.width || !p.length).length} productos con dimensiones incompletas, usando heurística avanzada`);
    usedDefaults = true;
  }

  return {
    dimensions: heuristicDimensions,
    source: 'heuristic',
    warnings,
    usedDefaults,
  };
}

// Limpiar cache (para testing o actualizaciones)
export function clearDimensionsCache(): void {
  dimensionsCache.clear();
  logger.info('[ME2] Dimensions: Cache limpiado');
}

// Obtener estadísticas del cache
export function getDimensionsCacheStats(): { size: number; keys: string[] } {
  return {
    size: dimensionsCache.size,
    keys: Array.from(dimensionsCache.keys()),
  };
}
