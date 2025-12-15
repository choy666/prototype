import { logger } from '@/lib/utils/logger';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre';
import { validateME2Calculation } from './me2Validator';
import type { ME2CalculationRequest, ME2Dimensions, ProductForCalculation } from './me2Validator';
import type { MLShippingMethod } from '@/lib/types/shipping';
import { retryWithBackoff } from '@/lib/utils/retry';
import { getApiUrl } from '@/lib/config/integrations';

// Interfaces para respuesta de Mercado Libre
interface MLOption {
  shipping_method_id: number;
  name: string;
  shipping_option_type: string;
  currency_id: string;
  list_cost: number;
  cost: number;
  estimated_delivery_time?: {
    date?: string;
    time_frame?: {
      from?: string;
      to?: string;
    };
    type?: string;
    unit?: string;
    shipping?: number;
    handling?: number;
  };
  shipping_method_type?: string;
  id?: number;
}

interface MLResponse {
  options?: MLOption[];
  destination?: {
    zip_code?: string;
    city?: {
      id?: string;
      name?: string;
    };
    state?: {
      id?: string;
      name?: string;
    };
    country?: {
      id?: string;
      name?: string;
    };
  };
}

// Cache en memoria para deduplicación (TTL 30 segundos)
const calculationCache = new Map<string, { 
  ts: number; 
  result: ME2ShippingResult; 
  inProgress?: Promise<ME2ShippingResult>;
}>();
const CACHE_TTL = 30 * 1000; // 30 segundos
const MAX_CACHE_SIZE = 1000; // Límite para prevenir memory leaks

// Cache para solicitudes en progreso (evitar duplicados simultáneos)
const inProgressRequests = new Map<string, Promise<ME2ShippingResult>>();

// Cleanup interval para limpiar cache expirado
let cleanupInterval: NodeJS.Timeout | null = null;

// Iniciar cleanup interval si no está activo
function startCleanupInterval(): void {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      cleanExpiredCache();
      enforceCacheSizeLimit();
    }, 5 * 60 * 1000); // Cada 5 minutos
    logger.info('[ME2] Cache: Cleanup interval iniciado');
  }
}

// Iniciar cleanup al cargar el módulo
startCleanupInterval();

export interface ME2ShippingResult {
  shippingOptions: MLShippingMethod[];
  cheapestOption?: MLShippingMethod | null;
  estimatedDelivery: number;
  totalCost: number;
  currency: string;
  coverage?: Record<string, unknown>;
  destination?: Record<string, unknown>;
  source?: 'me2' | 'local';
  input?: Record<string, unknown>;
  fallback?: boolean;
  message?: string;
  warnings?: string[];
}

// Generar hash de cache robusto
function generateCacheKey(zipcode: string, items: ProductForCalculation[]): string {
  // Normalizar items: ordenar por ID, incluir quantity y price
  const normalizedItems = items
    .map((item: ProductForCalculation) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
    }))
    .sort((a: ProductForCalculation, b: ProductForCalculation) => String(a.id).localeCompare(String(b.id)));
  
  const hashInput = `${zipcode}:${JSON.stringify(normalizedItems)}`;
  
  // Hash simple pero efectivo
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32-bit integer
  }
  
  return Math.abs(hash).toString();
}

// Limpiar cache expirado y enforce size limit
function cleanExpiredCache(): void {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, entry] of calculationCache.entries()) {
    if (now - entry.ts > CACHE_TTL) {
      calculationCache.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.info('[ME2] Cache: Limpieza de entradas expiradas', {
      cleanedCount,
      remainingEntries: calculationCache.size
    });
  }
}

// Forzar límite de tamaño de cache (LRU simple)
function enforceCacheSizeLimit(): void {
  if (calculationCache.size <= MAX_CACHE_SIZE) {
    return;
  }
  
  // Ordenar por timestamp y eliminar las más antiguas
  const entries = Array.from(calculationCache.entries())
    .sort((a, b) => a[1].ts - b[1].ts);
  
  const toDelete = entries.slice(0, calculationCache.size - MAX_CACHE_SIZE + 100); // Dejar buffer de 100
  let deletedCount = 0;
  
  for (const [key] of toDelete) {
    calculationCache.delete(key);
    deletedCount++;
  }
  
  logger.warn('[ME2] Cache: Límite de tamaño excedido, limpiando entradas antiguas', {
    deletedCount,
    currentSize: calculationCache.size,
    maxSize: MAX_CACHE_SIZE
  });
}

// Obtener desde cache
function getFromCache(key: string): ME2ShippingResult | null {
  cleanExpiredCache();
  
  const entry = calculationCache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.ts > CACHE_TTL) {
    calculationCache.delete(key);
    return null;
  }
  
  logger.info('[ME2] Cache: Usando resultado cacheado', { cacheKey: key });
  return entry.result;
}

// Guardar en cache
function setCache(key: string, result: ME2ShippingResult): void {
  calculationCache.set(key, {
    ts: Date.now(),
    result,
  });
  
  logger.info('[ME2] Cache: Resultado guardado', { cacheKey: key });
}

// Llamar a API de Mercado Libre ME2
async function callMercadoLibreShippingAPI(
  mlItemId: string,
  zipcode: string,
  dimensions: ME2Dimensions,
  quantity: number = 1
): Promise<Record<string, unknown>> {
  const auth = await MercadoLibreAuth.getInstance();
  const accessToken = await auth.getAccessToken();
  
  if (!accessToken) {
    throw new MercadoLibreError(
      MercadoLibreErrorCode.AUTH_FAILED,
      'No se encontró token de acceso a Mercado Libre'
    );
  }

  const url = getApiUrl('mercadolibre', '/shipping_options/{item_id}', {
    item_id: mlItemId
  }) + `?zip_code=${encodeURIComponent(zipcode)}`;
  
  logger.info('[ME2] API: Consultando Mercado Libre', {
    url,
    zipcode,
    itemId: mlItemId,
    dimensions,
    quantity
  });

  const response = await retryWithBackoff(async () => {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    
    if (!res.ok) {
      const errorBody = await res.text();
      
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('ME2 DEV - Error response from ML shipping_options', {
          status: res.status,
          zipcode,
          itemId: mlItemId,
          url,
          responseBody: errorBody,
        });
      }

      throw new MercadoLibreError(
        MercadoLibreErrorCode.SHIPPING_CALCULATION_FAILED,
        `Error calculando envío ME2: ${errorBody}`,
        { status: res.status, zipcode, itemId: mlItemId }
      );
    }
    
    return res;
  }, {
    maxRetries: 3,
    shouldRetry: (error) => {
      return error instanceof MercadoLibreError && 
             (error.code === MercadoLibreErrorCode.CONNECTION_ERROR ||
              error.code === MercadoLibreErrorCode.TIMEOUT_ERROR ||
              error.code === MercadoLibreErrorCode.API_UNAVAILABLE);
    }
  });

  return await response.json();
}

// Procesar respuesta de Mercado Libre
function processMercadoLibreResponse(rawData: MLResponse, dimensions: ME2Dimensions): ME2ShippingResult {
  const shippingOptions: MLShippingMethod[] = (rawData.options ?? []).map((option: MLOption): MLShippingMethod => ({
    shipping_method_id: option.shipping_method_id,
    name: option.name,
    description: option.shipping_option_type === 'address'
      ? 'Envío a domicilio'
      : option.shipping_option_type === 'agency'
        ? 'Retiro en sucursal de correo'
        : 'Opción de envío',
    currency_id: option.currency_id,
    list_cost: option.list_cost,
    cost: option.cost,
    estimated_delivery: {
      date: option.estimated_delivery_time?.date ?? '',
      time_from: option.estimated_delivery_time?.time_frame?.from ?? '',
      time_to: option.estimated_delivery_time?.time_frame?.to ?? '',
    },
    estimated_delivery_time: option.estimated_delivery_time
      ? {
          type: option.estimated_delivery_time.type ?? 'unknown_frame',
          unit: option.estimated_delivery_time.unit ?? 'hour',
          value: option.estimated_delivery_time.shipping ?? 0,
        }
      : undefined,
    shipping_mode: 'me2',
    logistic_type: option.shipping_option_type,
    treatment: option.shipping_method_type,
    guaranteed: false,
    order_priority: option.id,
    tags: [],
    speed: {
      handling: option.estimated_delivery_time?.handling ?? 0,
      shipping: option.estimated_delivery_time?.shipping ?? 0,
    },
  }));

  const cheapestOption = shippingOptions.length > 0 
    ? shippingOptions.reduce((min, option) => 
        (option.cost || 0) < (min.cost || 0) ? option : min
      )
    : null;

  return {
    shippingOptions,
    cheapestOption,
    estimatedDelivery: cheapestOption?.estimated_delivery_time?.value ?? 5,
    totalCost: cheapestOption?.cost || 0,
    currency: cheapestOption?.currency_id || 'ARS',
    coverage: {
      all_country: true,
      excluded_places: [],
    },
    destination: rawData.destination ? {
      type: 'address',
      zip_code: rawData.destination.zip_code || '',
      city_id: rawData.destination.city?.id || '',
      city_name: rawData.destination.city?.name || '',
      state_id: rawData.destination.state?.id || '',
      state_name: rawData.destination.state?.name || '',
      country_id: rawData.destination.country?.id || '',
      country_name: rawData.destination.country?.name || '',
    } : undefined,
    source: 'me2',
    input: {
      zipcode_source: '',
      zipcode_target: '',
      dimensions,
      item_price: 0,
      free_shipping: false,
      list_cost: cheapestOption?.list_cost ?? 0,
      cost: cheapestOption?.cost ?? 0,
      seller_id: 0,
    },
    fallback: false,
    message: 'Cálculo ME2 exitoso',
  };
}

// Fallback local para envíos
async function calculateLocalShippingFallback(zipcode: string, items: ProductForCalculation[]): Promise<ME2ShippingResult> {
  try {
    logger.info('[ME2] Fallback: calculando envío local', {
      zipcode,
      itemCount: items.length,
      totalAmount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    });

    // Importar dinámicamente para evitar dependencias circulares
    const { shippingMethods } = await import('@/lib/schema');
    const { db } = await import('@/lib/db');
    const { eq } = await import('drizzle-orm');

    const methods = await db
      .select()
      .from(shippingMethods)
      .where(eq(shippingMethods.isActive, true));

    if (!methods.length) {
      throw new Error('No hay métodos de envío locales activos configurados');
    }

    const now = new Date();
    const estimatedDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const estimatedDateString = estimatedDate.toISOString().split('T')[0];

    const shippingOptions: MLShippingMethod[] = methods.map((method): MLShippingMethod => ({
      shipping_method_id: method.id,
      name: method.name,
      description: 'Envío configurado localmente en la tienda',
      list_cost: Number(method.baseCost) || 0,
      cost: Number(method.baseCost) || 0,
      currency_id: 'ARS',
      estimated_delivery: {
        date: estimatedDateString,
        time_from: '09:00',
        time_to: '18:00',
      },
      estimated_delivery_time: {
        type: 'known_frame',
        unit: 'days',
        value: 5,
      },
      shipping_mode: 'custom',
      logistic_type: 'custom',
      treatment: 'custom',
      guaranteed: false,
      order_priority: method.id,
      tags: ['local'],
      speed: {
        handling: 1,
        shipping: 4,
      },
    }));

    const cheapestOption = shippingOptions.reduce((min, option) =>
      (option.cost || 0) < (min.cost || 0) ? option : min
    );

    return {
      shippingOptions,
      cheapestOption,
      estimatedDelivery: 5,
      totalCost: cheapestOption?.cost || 0,
      currency: 'ARS',
      source: 'local',
      fallback: true,
      message: 'Usando métodos de envío locales configurados en la tienda',
    };
  } catch (error) {
    logger.error('Error calculando envío local de fallback', {
      zipcode,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Función principal de cálculo ME2 con validación y cache
export async function calculateME2Shipping(request: ME2CalculationRequest): Promise<ME2ShippingResult> {
  const { zipcode, items, allowFallback = true } = request;

  try {
    logger.info('[ME2] API: Iniciando cálculo con validación', {
      zipcode,
      itemCount: items.length,
      allowFallback,
      items: items.map((i: ProductForCalculation) => ({ id: i.id, quantity: i.quantity, price: i.price }))
    });

    // 1. Validar productos y obtener dimensiones
    const validation = await validateME2Calculation({
      zipcode,
      items,
      allowFallback,
    });

    logger.info('[ME2] Validación: Resultado', {
      canUseME2: validation.canUseME2,
      reason: validation.reason,
      missingAttributes: validation.missingAttributes,
      warningsCount: validation.warnings.length,
      hasDimensions: !!validation.dimensions
    });

    // 2. Si no puede usar ME2 y no permite fallback, error
    if (!validation.canUseME2 && !allowFallback) {
      throw new MercadoLibreError(
        MercadoLibreErrorCode.SHIPPING_CALCULATION_FAILED,
        `Productos no válidos para ME2: ${validation.missingAttributes.join(', ')}`,
        { reason: validation.reason, missingAttributes: validation.missingAttributes }
      );
    }

    // 3. Generar cache key y verificar cache
    const cacheKey = generateCacheKey(zipcode, items);
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      return {
        ...cachedResult,
        warnings: [...(cachedResult.warnings || []), ...validation.warnings],
      };
    }

    // 4. Verificar si hay solicitud en progreso (deduplicación simultánea)
    if (inProgressRequests.has(cacheKey)) {
      logger.info('[ME2] API: Esperando solicitud en progreso', { cacheKey });
      const inProgressResult = await inProgressRequests.get(cacheKey)!;
      return inProgressResult;
    }

    // 5. Iniciar cálculo asíncrono con cache de progreso
    const calculationPromise = (async () => {
      try {
        let result: ME2ShippingResult;

        if (validation.canUseME2 && validation.dimensions) {
          // Usar ME2 real
          const firstItem = items[0];
          if (!firstItem?.mlItemId) {
      const errorMsg = `Falta mlItemId para el item ${firstItem.id} para el zipcode ${zipcode}`;
      logger.error('[ME2] Error: ' + errorMsg, { zipcode, localProductId: firstItem.id });
            throw new MercadoLibreError(
              MercadoLibreErrorCode.SHIPPING_CALCULATION_FAILED,
        errorMsg
            );
          }

          const rawData = await callMercadoLibreShippingAPI(
            firstItem.mlItemId,
            zipcode,
            validation.dimensions,
            firstItem.quantity
          );

          result = processMercadoLibreResponse(rawData, validation.dimensions);
          
          // Actualizar input data
          if (result.input) {
            result.input.zipcode_target = zipcode;
            result.input.item_price = firstItem.price;
          }

        } else {
          // Usar fallback local
          logger.warn('[ME2] API: Activando fallback local', {
            reason: validation.reason,
            missingAttributes: validation.missingAttributes,
            warnings: validation.warnings
          });

          result = await calculateLocalShippingFallback(zipcode, items);
        }

        // Agregar advertencias de validación
        if (validation.warnings.length > 0) {
          result.warnings = [...(result.warnings || []), ...validation.warnings];
        }

        // Guardar en cache
        setCache(cacheKey, result);

        return result;

      } finally {
        // Limpiar solicitud en progreso
        inProgressRequests.delete(cacheKey);
      }
    })();

    // Guardar solicitud en progreso
    inProgressRequests.set(cacheKey, calculationPromise);

    // Esperar resultado
    const result = await calculationPromise;

    logger.info('[ME2] API: Cálculo completado', {
      zipcode,
      success: true,
      source: result.source,
      fallback: result.fallback,
      optionsCount: result.shippingOptions.length,
      totalCost: result.totalCost,
      warningsCount: result.warnings?.length || 0
    });

    return result;

  } catch (error) {
    logger.error('[ME2] API: Error en cálculo', {
      zipcode,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof MercadoLibreError ? error.code : 'UNKNOWN',
      itemCount: items.length
    });

    // Si hay error y permite fallback, intentar envío local
    if (allowFallback) {
      logger.warn('[ME2] API: Activando fallback por error', {
        originalError: error instanceof Error ? error.message : String(error)
      });

      try {
        const fallbackResult = await calculateLocalShippingFallback(zipcode, items);
        return {
          ...fallbackResult,
          warnings: ['Error en ME2, usando envío local', ...(fallbackResult.warnings || [])],
        };
      } catch (fallbackError) {
        logger.error('[ME2] API: Error también en fallback', {
          zipcode,
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
      }
    }

    throw error;
  }
}

// Limpiar caches (para testing)
export function clearME2Cache(): void {
  calculationCache.clear();
  inProgressRequests.clear();
  logger.info('[ME2] Cache: Todos los caches limpiados');
}

// Obtener estadísticas de cache
export function getME2CacheStats(): { 
  cacheSize: number; 
  inProgressCount: number; 
  cacheKeys: string[];
} {
  cleanExpiredCache();
  return {
    cacheSize: calculationCache.size,
    inProgressCount: inProgressRequests.size,
    cacheKeys: Array.from(calculationCache.keys()),
  };
}
