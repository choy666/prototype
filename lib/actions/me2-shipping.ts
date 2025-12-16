import { db } from '@/lib/db';
import { retryWithBackoff } from '@/lib/utils/retry';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';
import { shippingMethods } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import type { MLShippingMethod } from '@/lib/types/shipping';
import type { MLShippingCalculateResponse } from '@/types/mercadolibre';
import { getValidatedME2Dimensions } from '@/lib/validations/me2-products';
import { me2ShippingCircuitBreaker } from '@/lib/utils/circuit-breaker';
import { getBusinessShippingConfig } from './business-settings';

// Configuración de Mercado Libre
const MERCADOLIBRE_API_URL = 'https://api.mercadolibre.com';

interface ShippingItem {
  id: string;
  quantity: number;
  price: number;
  mlItemId?: string;
}

interface ShippingDimensions {
  height: number;
  width: number;
  length: number;
  weight: number;
}

interface ME2ShippingOptions {
  zipcode: string;
  items: ShippingItem[];
  dimensions?: ShippingDimensions;
}

interface ME2ShippingResult {
  shippingOptions: MLShippingMethod[];
  cheapestOption?: MLShippingMethod | null;
  estimatedDelivery: number;
  totalCost: number;
  currency: string;
  coverage?: MLShippingCalculateResponse['coverage'];
  destination?: MLShippingCalculateResponse['destination'];
  source?: MLShippingCalculateResponse['source'];
  input?: MLShippingCalculateResponse['input'];
  fallback?: boolean;
  message?: string;
  warnings?: string[];
  pickup?: {
    available: boolean;
    types: ('agency' | 'place')[];
  };
}

interface MLItemShippingOption {
  id: number;
  option_hash?: string;
  name: string;
  currency_id: string;
  list_cost: number;
  cost: number;
  shipping_method_id: number;
  shipping_method_type: string;
  shipping_option_type: string;
  option_type?: string; // Agregado para evitar type assertion
  carrier_id?: number; // Agregado para verificar si ML devuelve carrier_id directo
  estimated_delivery_time?: {
    type?: string;
    date?: string;
    time_frame?: {
      from?: string;
      to?: string | null;
    };
    offset?: {
      date?: string;
    };
    shipping?: number;
    handling?: number;
    unit?: string; // Agregado para compatibilidad
    value?: number; // Agregado para compatibilidad
    schedule?: unknown; // Mantener como unknown si no tenemos la estructura exacta
    pay_before?: string;
  };
}

interface MLItemShippingOptionsApiResponse {
  destination: {
    zip_code: string;
    city: {
      id: string | null;
      name: string | null;
    } | null;
    state: {
      id: string;
      name: string;
    } | null;
    country: {
      id: string;
      name: string;
    } | null;
  };
  options: MLItemShippingOption[];
  custom_message?: {
    display_mode?: string | null;
    reason?: string;
  } | null;
}

async function calculateShippingCostsWithDimensions(
  options: ME2ShippingOptions, 
  dimensions: ShippingDimensions
): Promise<ME2ShippingResult> {
  try {
    logger.info('[ME2] Request: Calculando envío con /shipments/costs', {
      zipcode: options.zipcode,
      dimensions,
      itemCount: options.items.length
    });

    // Hacer request a la API de Mercado Libre con reintentos
    const auth = await MercadoLibreAuth.getInstance();
    const accessToken = await auth.getAccessToken();
    
    if (!accessToken) {
      throw new MercadoLibreError(
        MercadoLibreErrorCode.AUTH_FAILED,
        'No se encontró token de acceso a Mercado Libre'
      );
    }

    const firstItem = options.items[0];
    
    // Obtener seller_id de las variables de entorno
    const sellerId = process.env.ML_SELLER_ID;
    
    if (!sellerId) {
      throw new MercadoLibreError(
        MercadoLibreErrorCode.SHIPPING_CALCULATION_FAILED,
        'No se encontró ML_SELLER_ID en las variables de entorno'
      );
    }
    
    const requestBody = {
      seller_id: parseInt(sellerId),
      zip_code_from: process.env.BUSINESS_ZIP_CODE || '1001', // Código postal del negocio
      zip_code_to: options.zipcode,
      dimensions: {
        height: dimensions.height,
        width: dimensions.width,
        length: dimensions.length,
        weight: dimensions.weight
      },
      item_price: firstItem.price,
      local_pickup: false,
      logistic_type: 'me2'
    };

    logger.info('[ME2] Request: Consultando API /shipments/costs', {
      url: `${MERCADOLIBRE_API_URL}/shipments/costs`,
      zipcode: options.zipcode,
      dimensions,
      requestBody
    });

    const response = await me2ShippingCircuitBreaker.execute(async () => {
      return await retryWithBackoff(async () => {
        const url = `${MERCADOLIBRE_API_URL}/shipments/costs`;
        
        // Timeout handling con Promise.race() - 8 segundos máximo para API calls
        const timeoutPromise = new Promise<Response>((_, reject) => {
          setTimeout(() => {
            reject(new MercadoLibreError(
              MercadoLibreErrorCode.TIMEOUT_ERROR,
              'Timeout en llamada a API de Mercado Libre (8s)',
              { url, zipcode: options.zipcode, timeout: 8000 }
            ));
          }, 8000);
        });

        const apiCall = fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const res = await Promise.race([apiCall, timeoutPromise]) as Response;
        
        if (!res.ok) {
          const errorBody = await res.text();

          if (process.env.NODE_ENV === 'development') {
            // Log de depuración SIN sanitizar para entorno de desarrollo
            // eslint-disable-next-line no-console
            console.error('ME2 DEV - Error response from ML /shipments/costs', {
              status: res.status,
              zipcode: options.zipcode,
              url,
              requestBody,
              responseBody: errorBody,
            });
          }

          // Rate limit handling específico
          if (res.status === 429) {
            throw new MercadoLibreError(
              MercadoLibreErrorCode.RATE_LIMIT_EXCEEDED,
              `Rate limit excedido en API de Mercado Libre: ${errorBody}`,
              { status: res.status, zipcode: options.zipcode, retryAfter: res.headers.get('Retry-After') }
            );
          }

          // Authentication errors - excluir del circuit breaker
          if (res.status === 401 || res.status === 403) {
            logger.warn('[ME2] Error: Problema de autenticación con Mercado Libre', {
              status: res.status,
              zipcode: options.zipcode,
              errorBody: errorBody.substring(0, 200) // Limitar longitud
            });
            
            // Forzar refresh de token
            const auth = await MercadoLibreAuth.getInstance();
            await auth.refreshAccessToken();
            
            // Lanzar error especial que no afecta al circuit breaker
            const authError = new MercadoLibreError(
              MercadoLibreErrorCode.AUTH_FAILED,
              `Error de autenticación con Mercado Libre: ${errorBody}`,
              { status: res.status, zipcode: options.zipcode }
            );
            // Marcar para que circuit breaker no cuente este fallo
            (authError as MercadoLibreError & { skipCircuitBreaker?: boolean }).skipCircuitBreaker = true;
            throw authError;
          }

          throw new MercadoLibreError(
            MercadoLibreErrorCode.SHIPPING_CALCULATION_FAILED,
            `Error calculando envío ME2: ${errorBody}`,
            { status: res.status, zipcode: options.zipcode, dimensions }
          );
        }
        
        return res;
      }, {
        maxRetries: 3,
        shouldRetry: (error) => {
          if (error instanceof MercadoLibreError) {
            // No reintentar en errores de autenticación (se refresh el token)
            if (error.code === MercadoLibreErrorCode.AUTH_FAILED) return false;
            
            // Reintentar con más backoff para rate limits
            if (error.code === MercadoLibreErrorCode.RATE_LIMIT_EXCEEDED) return true;
            
            // Reintentar errores de conexión y timeout
            return error.code === MercadoLibreErrorCode.CONNECTION_ERROR ||
                   error.code === MercadoLibreErrorCode.TIMEOUT_ERROR ||
                   error.code === MercadoLibreErrorCode.API_UNAVAILABLE;
          }
          return false;
        },
        initialDelay: 1000, // 1 segundo base delay
        maxDelay: 10000  // 10 segundos máximo delay
      });
    });

    const rawData = await response.json();
    
    logger.info('[ME2] Response: Opciones obtenidas de /shipments/costs', {
      optionsCount: rawData.options?.length || 0,
      zipcode: options.zipcode
    });

    // Procesar respuesta de /shipments/costs
    const shippingOptions: MLShippingMethod[] = (rawData.options ?? []).map((option: {
      shipping_method_id?: number;
      id?: number;
      name?: string;
      description?: string;
      currency_id?: string;
      list_cost?: number;
      cost?: number;
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
      logistic_type?: string;
      treatment?: string;
      order_priority?: number;
    }): MLShippingMethod => ({
      shipping_method_id: option.shipping_method_id || option.id,
      name: option.name || 'Envío Estándar',
      description: option.description || 'Envío a domicilio',
      currency_id: option.currency_id || 'ARS',
      list_cost: option.list_cost || option.cost,
      cost: option.cost || 0,
      estimated_delivery: {
        date: option.estimated_delivery_time?.date ?? '',
        time_from: option.estimated_delivery_time?.time_frame?.from ?? '',
        time_to: option.estimated_delivery_time?.time_frame?.to ?? '',
      },
      estimated_delivery_time: option.estimated_delivery_time
        ? {
            type: option.estimated_delivery_time.type ?? 'known_frame',
            unit: option.estimated_delivery_time.unit ?? 'days',
            value: option.estimated_delivery_time.shipping ?? 5,
          }
        : undefined,
      shipping_mode: 'me2',
      logistic_type: option.logistic_type || 'drop_off',
      treatment: option.treatment || 'standard',
      guaranteed: false,
      order_priority: option.order_priority || 1,
      tags: ['me2'],
      speed: {
        handling: option.estimated_delivery_time?.handling ?? 1,
        shipping: option.estimated_delivery_time?.shipping ?? 4,
      },
      // Campos adicionales para envíos a agencia
      deliver_to: option.name?.toLowerCase().includes('sucursal') || option.name?.toLowerCase().includes('agencia') || option.name?.toLowerCase().includes('correo') ? 'agency' : 'address',
      carrier_id: option.shipping_method_id || option.id || 154 // Default a 154 para envíos a sucursal
    }));

    const cheapestOption = shippingOptions.length > 0 
      ? shippingOptions.reduce((min, option) => 
          (option.cost || 0) < (min.cost || 0) ? option : min
        )
      : null;

    const result: ME2ShippingResult = {
      shippingOptions,
      cheapestOption,
      estimatedDelivery: cheapestOption?.estimated_delivery_time?.value ?? 5,
      totalCost: cheapestOption?.cost || 0,
      currency: cheapestOption?.currency_id || 'ARS',
      source: 'me2',
      fallback: false,
      message: 'Cálculo ME2 exitoso usando /shipments/costs',
      pickup: { available: false, types: [] }, // /shipments/costs no devuelve info de pickup
    };

    logger.info('[ME2] Response: Cálculo completado con /shipments/costs', {
      zipcode: options.zipcode,
      totalCost: result.totalCost,
      optionsCount: shippingOptions.length,
      deliveryDays: result.estimatedDelivery,
      cheapestOption: cheapestOption?.name || 'N/A',
      source: result.source,
      fallback: result.fallback
    });

    return result;

  } catch (error) {
    logger.error('[ME2] Error: Error en cálculo de envío con /shipments/costs', {
      zipcode: options.zipcode,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof MercadoLibreError ? error.code : 'UNKNOWN',
    });

    logger.warn('[ME2] Fallback: Activando envío local por error de /shipments/costs', {
      zipcode: options.zipcode,
      originalError: error instanceof Error ? error.message : String(error),
      itemCount: options.items.length
    });

    // En caso de error, usar métodos locales configurados en BD como fallback
    return await calculateLocalShippingFallback(options.zipcode, options.items);
  }
}

async function calculateLocalShippingFallback(zipcode: string, items: ShippingItem[]): Promise<ME2ShippingResult> {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  try {
    const methods = await db
      .select()
      .from(shippingMethods)
      .where(eq(shippingMethods.isActive, true));

    // Si no hay métodos configurados, usar uno por defecto
    if (!methods.length) {
      logger.warn('[ME2] Fallback: No hay métodos locales configurados, usando envío por defecto', {
        zipcode,
        itemCount: items.length
      });

      const defaultCost = 500; // $500 por defecto
      const now = new Date();
      const estimatedDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      const estimatedDateString = estimatedDate.toISOString().split('T')[0];

      const defaultOption: MLShippingMethod = {
        shipping_method_id: -1,
        name: 'Envío Estándar',
        description: 'Envío estándar a todo el país',
        list_cost: defaultCost,
        cost: defaultCost,
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
        order_priority: 1,
        tags: ['fallback'],
        speed: {
          handling: 1,
          shipping: 4,
        },
      };

      const result: ME2ShippingResult = {
        shippingOptions: [defaultOption],
        cheapestOption: defaultOption,
        estimatedDelivery: 5,
        totalCost: defaultCost,
        currency: 'ARS',
        source: 'local',
        fallback: true,
        message: 'Usando envío estándar por defecto (no hay métodos locales configurados)',
        warnings: ['No hay métodos de envío locales configurados en la base de datos'],
        pickup: { available: false, types: [] },
      };

      return result;
    }

    const now = new Date();
    const estimatedDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const estimatedDateString = estimatedDate.toISOString().split('T')[0];

    const shippingOptions: MLShippingMethod[] = methods.map((method): MLShippingMethod => {
      const baseCost = Number(method.baseCost) || 0;
      const freeThreshold = method.freeThreshold != null ? Number(method.freeThreshold) : null;
      const cost = freeThreshold !== null && subtotal >= freeThreshold ? 0 : baseCost;

      return {
        shipping_method_id: method.id,
        name: method.name,
        description: 'Envío configurado localmente en la tienda',
        list_cost: cost,
        cost,
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
      };
    });

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
      pickup: { available: false, types: [] },
    };
  } catch (error) {
    logger.error('Error calculando envío local de fallback', {
      zipcode,
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Último recurso: retornar un envío básico para no bloquear el checkout
    logger.warn('[ME2] Fallback último recurso: usando envío básico de emergencia', {
      zipcode,
      itemCount: items.length
    });

    const emergencyCost = 800; // Costo de emergencia más alto
    const now = new Date();
    const estimatedDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 días
    const estimatedDateString = estimatedDate.toISOString().split('T')[0];

    const emergencyOption: MLShippingMethod = {
      shipping_method_id: -999,
      name: 'Envío Nacional',
      description: 'Envío a todo el país',
      list_cost: emergencyCost,
      cost: emergencyCost,
      currency_id: 'ARS',
      estimated_delivery: {
        date: estimatedDateString,
        time_from: '09:00',
        time_to: '18:00',
      },
      estimated_delivery_time: {
        type: 'known_frame',
        unit: 'days',
        value: 7,
      },
      shipping_mode: 'custom',
      logistic_type: 'custom',
      treatment: 'custom',
      guaranteed: false,
      order_priority: 999,
      tags: ['emergency'],
      speed: {
        handling: 2,
        shipping: 5,
      },
    };

    return {
      shippingOptions: [emergencyOption],
      cheapestOption: emergencyOption,
      estimatedDelivery: 7,
      totalCost: emergencyCost,
      currency: 'ARS',
      source: 'local',
      fallback: true,
      message: 'Usando envío de emergencia (error en sistema de envíos)',
      warnings: ['Hubo un error al calcular el envío, se aplicó un costo estándar'],
      pickup: { available: false, types: [] },
    };
  }
}

// Calcular costo de envío usando API de Mercado Libre ME2
export async function calculateME2ShippingCost(options: ME2ShippingOptions): Promise<ME2ShippingResult> {
  // Para Argentina, extraer solo los números del zipcode
  // La API de ML espera solo números (ej: "5500", no "M5500")
  const cleanZipcode = options.zipcode.replace(/[^\d]/g, '');
  
  logger.info('[ME2] Request: Iniciando cálculo de envío', {
    zipcode: options.zipcode,
    cleanZipcode: cleanZipcode,
    itemCount: options.items.length,
    items: options.items.map(item => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
      mlItemId: item.mlItemId
    }))
  });

  try {
    // VERIFICAR ENVÍO INTERNO ANTES DE LLAMAR A ME2
    const businessShippingConfig = await getBusinessShippingConfig();
    
    if (businessShippingConfig && cleanZipcode === businessShippingConfig.zipCode) {
      logger.info('[ME2] Envío interno detectado', { 
        zipcode: cleanZipcode, 
        businessZipCode: businessShippingConfig.zipCode,
        isInternal: true 
      });
      
      // Calcular total del pedido para determinar si es gratis
      const orderTotal = options.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const shippingCost = orderTotal >= businessShippingConfig.freeShippingThreshold ? 0 : businessShippingConfig.internalShippingCost;
      
      // Retornar opciones de envío interno
      const internalOptions: MLShippingMethod[] = [
        {
          id: 'internal-standard',
          name: shippingCost === 0 ? 'Envío Interno Gratis' : 'Envío Interno Estándar',
          description: 'Entrega en 24 horas hábiles',
          cost: shippingCost,
          estimatedTime: '24 horas',
          currency: 'ARS',
          type: 'internal'
        }
      ];
      
      return {
        shippingOptions: internalOptions,
        cheapestOption: internalOptions[0],
        estimatedDelivery: 1,
        totalCost: shippingCost,
        currency: 'ARS',
        source: 'internal_shipping',
        message: shippingCost === 0 ? 'Envío gratis por superar el monto mínimo' : 'Envío interno estándar',
        pickup: { available: false, types: [] }, // Envíos internos no tienen retiro en sucursal
      };
    }

    // Obtener dimensiones validadas de los productos con validaciones ME2
    const productIds = options.items.map(item => parseInt(item.id)).filter(id => !isNaN(id));
    const dimensionsData = await getValidatedME2Dimensions(productIds);
    const dimensions = options.dimensions || dimensionsData.dimensions;
    
    // Log de advertencias ME2 si hay productos inválidos
    if (dimensionsData.hasInvalidProducts) {
      logger.warn('[ME2] Validación: Advertencias de productos detectadas', {
        zipcode: options.zipcode,
        warnings: dimensionsData.validationWarnings.slice(0, 5), // Limitar a primeras 5 advertencias
        hasInvalidProducts: dimensionsData.hasInvalidProducts
      });
    }
    
    logger.info('[ME2] Request: Obteniendo dimensiones de productos', { dimensions });

    // Hacer request a la API de Mercado Libre con reintentos
    const auth = await MercadoLibreAuth.getInstance();
    const accessToken = await auth.getAccessToken();
    
    if (!accessToken) {
      throw new MercadoLibreError(
        MercadoLibreErrorCode.AUTH_FAILED,
        'No se encontró token de acceso a Mercado Libre'
      );
    }

    // Para Argentina, usamos el primer item para calcular (ML API funciona por item)
    const firstItem = options.items[0];
    if (!firstItem) {
      throw new MercadoLibreError(
        MercadoLibreErrorCode.SHIPPING_CALCULATION_FAILED,
        'Se requiere al menos un item para calcular envío'
      );
    }

    const mlItemId = firstItem.mlItemId;

    logger.info('[ME2] Request: Consultando API de Mercado Libre', {
      url: `${MERCADOLIBRE_API_URL}/items/${mlItemId}/shipping_options`,
      zipcode: cleanZipcode,
      itemId: mlItemId,
      dimensions,
      logisticType: 'me2'
    });

    if (!mlItemId) {
      logger.warn('[ME2] Warning: Falta mlItemId para el item, usando /shipments/costs', {
        zipcode: cleanZipcode,
        localProductId: firstItem.id,
      });

      // Usar /shipments/costs cuando no hay mlItemId
      return await calculateShippingCostsWithDimensions({ ...options, zipcode: cleanZipcode }, dimensions);
    }

    const requestBody = {
      zipcode: cleanZipcode,
      item_id: mlItemId,
      quantity: firstItem.quantity,
      dimensions: {
        height: dimensions.height,
        width: dimensions.width,
        length: dimensions.length,
        weight: dimensions.weight
      },
      local_pickup: false,
      logistic_type: 'me2'
    };

    const response = await me2ShippingCircuitBreaker.execute(async () => {
      return await retryWithBackoff(async () => {
        const url = `${MERCADOLIBRE_API_URL}/items/${mlItemId}/shipping_options?zip_code=${encodeURIComponent(cleanZipcode)}`;
        
        // Timeout handling con Promise.race() - 8 segundos máximo para API calls
        const timeoutPromise = new Promise<Response>((_, reject) => {
          setTimeout(() => {
            reject(new MercadoLibreError(
              MercadoLibreErrorCode.TIMEOUT_ERROR,
              'Timeout en llamada a API de Mercado Libre (8s)',
              { url, zipcode: options.zipcode, timeout: 8000 }
            ));
          }, 8000);
        });

        const apiCall = fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        const res = await Promise.race([apiCall, timeoutPromise]) as Response;
        
        if (!res.ok) {
          const errorBody = await res.text();

          if (process.env.NODE_ENV === 'development') {
            // Log de depuración SIN sanitizar para entorno de desarrollo
            // eslint-disable-next-line no-console
            console.error('ME2 DEV - Error response from ML shipping_options', {
              status: res.status,
              zipcode: options.zipcode,
              itemId: mlItemId,
              url,
              requestBody,
              responseBody: errorBody,
            });
          }

          // Rate limit handling específico
          if (res.status === 429) {
            throw new MercadoLibreError(
              MercadoLibreErrorCode.RATE_LIMIT_EXCEEDED,
              `Rate limit excedido en API de Mercado Libre: ${errorBody}`,
              { status: res.status, zipcode: options.zipcode, retryAfter: res.headers.get('Retry-After') }
            );
          }

          // Authentication errors - excluir del circuit breaker
          if (res.status === 401 || res.status === 403) {
            logger.warn('[ME2] Error: Problema de autenticación con Mercado Libre', {
              status: res.status,
              zipcode: options.zipcode,
              itemId: mlItemId,
              errorBody: errorBody.substring(0, 200) // Limitar longitud
            });
            
            // Forzar refresh de token
            const auth = await MercadoLibreAuth.getInstance();
            await auth.refreshAccessToken();
            
            // Lanzar error especial que no afecta al circuit breaker
            const authError = new MercadoLibreError(
              MercadoLibreErrorCode.AUTH_FAILED,
              `Error de autenticación con Mercado Libre: ${errorBody}`,
              { status: res.status, zipcode: options.zipcode }
            );
            // Marcar para que circuit breaker no cuente este fallo
            (authError as MercadoLibreError & { skipCircuitBreaker?: boolean }).skipCircuitBreaker = true;
            throw authError;
          }

          throw new MercadoLibreError(
            MercadoLibreErrorCode.SHIPPING_CALCULATION_FAILED,
            `Error calculando envío ME2: ${errorBody}`,
            { status: res.status, zipcode: options.zipcode, dimensions, itemId: mlItemId }
          );
        }
        
        return res;
      }, {
        maxRetries: 3,
        shouldRetry: (error) => {
          if (error instanceof MercadoLibreError) {
            // No reintentar en errores de autenticación (se refresh el token)
            if (error.code === MercadoLibreErrorCode.AUTH_FAILED) return false;
            
            // Reintentar con más backoff para rate limits
            if (error.code === MercadoLibreErrorCode.RATE_LIMIT_EXCEEDED) return true;
            
            // Reintentar errores de conexión y timeout
            return error.code === MercadoLibreErrorCode.CONNECTION_ERROR ||
                   error.code === MercadoLibreErrorCode.TIMEOUT_ERROR ||
                   error.code === MercadoLibreErrorCode.API_UNAVAILABLE;
          }
          return false;
        },
        initialDelay: 1000, // 1 segundo base delay
        maxDelay: 10000  // 10 segundos máximo delay
      });
    });

    const rawData = (await response.json()) as MLItemShippingOptionsApiResponse;
    
    logger.info('[ME2] Response: Opciones obtenidas de Mercado Libre', {
      optionsCount: rawData.options?.length || 0,
      zipcode: cleanZipcode,
      destination: rawData.destination,
      allOptions: rawData.options?.map((opt) => ({
        shipping_method_id: opt.shipping_method_id,
        name: opt.name,
        carrier_id: opt.carrier_id,
        option_type: opt.option_type || opt.shipping_option_type,
      })),
      agencyOption: rawData.options?.find((opt) => 
        (opt.option_type === 'agency' || opt.shipping_option_type === 'agency')
      ),
    });
    
    // Procesar resultados según la estructura real de la API de ML
    // Detectar opciones de retiro (agency/place) para habilitar selector
    const pickupTypes: ('agency' | 'place')[] = [];
    const shippingOptions: MLShippingMethod[] = (rawData.options ?? []).map((option): MLShippingMethod => {
      const optionType = option.option_type ?? option.shipping_option_type;

      // Recolectar tipos de retiro disponibles
      if (optionType === 'agency' || optionType === 'place') {
        pickupTypes.push(optionType);
      }

      console.log('[ME2] Procesando opción:', {
        name: option.name,
        shipping_method_id: option.shipping_method_id,
        option_type: optionType,
        carrier_id: option.carrier_id,
      });

      return {
        shipping_method_id: option.shipping_method_id,
        option_id: option.id, // Agregar option_id para obtener sucursales
        option_hash: option.option_hash,
        state_id: rawData.destination?.state?.id, // Agregar state_id para endpoints geográficos
        name: option.name,
        description: optionType === 'address'
          ? 'Envío a domicilio'
          : optionType === 'agency'
            ? 'Retiro en sucursal de correo'
            : optionType === 'place'
              ? 'Retiro en punto de retiro'
              : 'Opción de envío',
        currency_id: option.currency_id,
        list_cost: option.list_cost,
        cost: option.cost,
        deliver_to: optionType === 'agency' || optionType === 'place' ? 'agency' : 'address',
        carrier_id: option.carrier_id, // Usar carrier_id directo si ML lo devuelve
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
        estimated_delivery_final: option.estimated_delivery_time?.date
          ? {
              date: option.estimated_delivery_time.date,
              time_from: option.estimated_delivery_time.time_frame?.from ?? '',
              time_to: option.estimated_delivery_time.time_frame?.to ?? '',
            }
          : undefined,
        shipping_mode: 'me2',
        logistic_type: 'me2',
        treatment: option.shipping_method_type,
        guaranteed: false,
        order_priority: option.id,
        tags: [],
        speed: {
          handling: option.estimated_delivery_time?.handling ?? 0,
          shipping: option.estimated_delivery_time?.shipping ?? 0,
        },
      };
    });

    const cheapestOption = shippingOptions.length > 0 
      ? shippingOptions.reduce((min, option) => 
          (option.cost || 0) < (min.cost || 0) ? option : min
        )
      : null;

    const coverage: MLShippingCalculateResponse['coverage'] = {
      all_country: true,
      excluded_places: [],
    };

    const destination: MLShippingCalculateResponse['destination'] | undefined = rawData.destination
      ? {
          type: 'address',
          zip_code: rawData.destination.zip_code,
          city_id: rawData.destination.city?.id ?? '',
          city_name: rawData.destination.city?.name ?? '',
          state_id: rawData.destination.state?.id ?? '',
          state_name: rawData.destination.state?.name ?? '',
          country_id: rawData.destination.country?.id ?? '',
          country_name: rawData.destination.country?.name ?? '',
        }
      : undefined;

    const input: MLShippingCalculateResponse['input'] = {
      zipcode_source: '',
      zipcode_target: options.zipcode,
      dimensions: {
        height: dimensions.height,
        width: dimensions.width,
        length: dimensions.length,
        weight: dimensions.weight,
      },
      item_price: firstItem.price,
      free_shipping: false,
      list_cost: cheapestOption?.list_cost ?? 0,
      cost: cheapestOption?.cost ?? 0,
      seller_id: 0,
    };

    const result: ME2ShippingResult = {
      shippingOptions,
      cheapestOption,
      estimatedDelivery: cheapestOption?.estimated_delivery_time?.value ?? 5,
      totalCost: cheapestOption?.cost || 0,
      currency: cheapestOption?.currency_id || 'ARS',
      coverage,
      destination,
      source: 'me2',
      input,
      fallback: false,
      pickup: {
        available: pickupTypes.length > 0,
        types: Array.from(new Set(pickupTypes)), // Eliminar duplicados
      },
    };

    logger.info('[ME2] Response: Cálculo completado', {
      zipcode: cleanZipcode,
      totalCost: result.totalCost,
      optionsCount: shippingOptions.length,
      deliveryDays: result.estimatedDelivery,
      cheapestOption: cheapestOption?.name || 'N/A',
      source: result.source,
      fallback: result.fallback,
      pickup: result.pickup // Log de disponibilidad de retiro
    });

    return result;

  } catch (error) {
    logger.error('[ME2] Error: Error en cálculo de envío', {
      zipcode: cleanZipcode,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof MercadoLibreError ? error.code : 'UNKNOWN',
      statusCode: error instanceof MercadoLibreError && error.details ? (error.details as { status?: number }).status : 'N/A'
    });

    if (process.env.NODE_ENV === 'development') {
      // Log adicional de depuración en desarrollo con el error completo
      // eslint-disable-next-line no-console
      console.error('[ME2] DEV - Error detallado', {
        zipcode: cleanZipcode,
        error,
        errorStack: error instanceof Error ? error.stack : 'N/A',
        details: error instanceof MercadoLibreError ? error.details : 'N/A'
      });
    }

    logger.warn('[ME2] Fallback: Activando envío local por error de ML', {
      zipcode: cleanZipcode,
      originalError: error instanceof Error ? error.message : String(error),
      itemCount: options.items.length
    });

    // En caso de error, usar métodos locales configurados en BD como fallback
    const fallbackResult = await calculateLocalShippingFallback(cleanZipcode, options.items);
    return fallbackResult;
  }
}

// Validar cobertura ME2 para un código postal
export async function validateME2Coverage(zipcode: string): Promise<{
  covered: boolean;
  availableOptions: string[];
  message: string;
}> {
  try {
    // Simular validación de cobertura (en producción, llamar a API real)
    const validPrefixes = ['1', '2', '3', '4', '5', '8', '9']; // Provincias cubiertas
    
    if (!zipcode || zipcode.length < 4) {
      return {
        covered: false,
        availableOptions: [],
        message: 'Código postal inválido'
      };
    }

    const prefix = zipcode.substring(0, 1);
    const isCovered = validPrefixes.includes(prefix);

    return {
      covered: isCovered,
      availableOptions: isCovered ? ['standard', 'express'] : [],
      message: isCovered 
        ? 'Cobertura ME2 disponible' 
        : 'Código postal sin cobertura ME2, usando envío estándar'
    };

  } catch (error) {
    logger.error('Error validando cobertura ME2', { zipcode, error });
    return {
      covered: false,
      availableOptions: [],
      message: 'Error validando cobertura, usando fallback'
    };
  }
}
