import { db } from '@/lib/db';
import { retryWithBackoff } from '@/lib/utils/retry';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';
import { shippingMethods } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import type { MLShippingMethod } from '@/lib/types/shipping';
import type { MLShippingCalculateResponse } from '@/types/mercadolibre';

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
}

interface MLItemShippingOption {
  id: number;
  name: string;
  currency_id: string;
  base_cost: number;
  cost: number;
  list_cost: number;
  shipping_method_id: number;
  shipping_method_type: string;
  shipping_option_type: string;
  estimated_delivery_time?: {
    type?: string;
    date?: string;
    unit?: string;
    offset?: {
      date?: string | null;
      shipping?: number | null;
    };
    time_frame?: {
      from?: string | null;
      to?: string | null;
    };
    pay_before?: string;
    shipping?: number;
    handling?: number;
    schedule?: string | null;
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

// Obtener dimensiones reales de los productos desde la base de datos
async function getProductsDimensions(items: ShippingItem[]): Promise<ShippingDimensions> {
  try {
    const productIds = items.map(item => parseInt(item.id)).filter(id => !isNaN(id));
    
    if (productIds.length === 0) {
      throw new Error('No hay IDs de productos válidos');
    }

    const dbProducts = await db.query.products.findMany({
      where: (products, { inArray }) => inArray(products.id, productIds),
      columns: {
        id: true,
        height: true,
        width: true,
        length: true,
        weight: true
      }
    });

    if (dbProducts.length === 0) {
      throw new Error('No se encontraron productos en la base de datos');
    }

    // Calcular dimensiones totales (suma de volúmenes, peso total)
    let totalHeight = 0;
    let totalWidth = 0;
    let totalLength = 0;
    let totalWeight = 0;

    for (const item of items) {
      const product = dbProducts.find(p => p.id === parseInt(item.id));
      if (!product) {
        logger.warn(`Producto ${item.id} no encontrado en BD, usando dimensiones por defecto`);
        continue;
      }

      const itemHeight = Number(product.height) || 10;
      const itemWidth = Number(product.width) || 10;
      const itemLength = Number(product.length) || 10;
      const itemWeight = Number(product.weight) || 0.5;

      // Para múltiples items, acumular peso
      totalWeight += itemWeight * item.quantity;
      
      // Calcular dimensiones aproximadas del paquete combinado
      totalLength = Math.max(totalLength, itemLength);
      totalWidth = Math.max(totalWidth, itemWidth);
      totalHeight += itemHeight * item.quantity;
    }

    return {
      height: totalHeight,
      width: totalWidth,
      length: totalLength,
      weight: totalWeight
    };

  } catch (error) {
    logger.error('Error obteniendo dimensiones de productos:', error);
    // Retornar dimensiones por defecto en caso de error
    return {
      height: 10,
      width: 10,
      length: 10,
      weight: 0.5
    };
  }
}

async function calculateLocalShippingFallback(zipcode: string, items: ShippingItem[]): Promise<ME2ShippingResult> {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  try {
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

// Calcular costo de envío usando API de Mercado Libre ME2
export async function calculateME2ShippingCost(options: ME2ShippingOptions): Promise<ME2ShippingResult> {
  try {
    logger.info('Calculando costo de envío ME2', { zipcode: options.zipcode, itemCount: options.items.length });

    // Obtener dimensiones reales de los productos
    const dimensions = options.dimensions || await getProductsDimensions(options.items);
    
    logger.info('Dimensiones calculadas', dimensions);

    // Preparar el payload para la API de ML

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

    if (!mlItemId) {
      logger.info('ME2: mlItemId no presente para el item, usando fallback local', {
        zipcode: options.zipcode,
        localProductId: firstItem.id,
      });

      return calculateLocalShippingFallback(options.zipcode, options.items);
    }

    const requestBody = {
      zipcode: options.zipcode,
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

    const response = await retryWithBackoff(async () => {
      const url = `${MERCADOLIBRE_API_URL}/items/${mlItemId}/shipping_options?zip_code=${encodeURIComponent(options.zipcode)}`;
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
        return error instanceof MercadoLibreError && 
               (error.code === MercadoLibreErrorCode.CONNECTION_ERROR ||
                error.code === MercadoLibreErrorCode.TIMEOUT_ERROR ||
                error.code === MercadoLibreErrorCode.API_UNAVAILABLE);
      }
    });

    const rawData = (await response.json()) as MLItemShippingOptionsApiResponse;
    
    // Procesar resultados según la estructura real de la API de ML
    const shippingOptions: MLShippingMethod[] = (rawData.options ?? []).map((option): MLShippingMethod => ({
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
      estimated_delivery_final: option.estimated_delivery_time?.date
        ? {
            date: option.estimated_delivery_time.date,
            time_from: option.estimated_delivery_time.time_frame?.from ?? '',
            time_to: option.estimated_delivery_time.time_frame?.to ?? '',
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
    };

    logger.info('Cálculo de envío ME2 completado', {
      zipcode: options.zipcode,
      totalCost: result.totalCost,
      optionsCount: shippingOptions.length,
      deliveryDays: result.estimatedDelivery
    });

    return result;

  } catch (error) {
    logger.error('Error en cálculo de envío ME2', {
      zipcode: options.zipcode,
      error: error instanceof Error ? error.message : String(error)
    });

    if (process.env.NODE_ENV === 'development') {
      // Log adicional de depuración en desarrollo con el error completo
      // eslint-disable-next-line no-console
      console.error('ME2 DEV - Error in calculateME2ShippingCost', {
        zipcode: options.zipcode,
        error,
      });
    }

    // En caso de error, usar métodos locales configurados en BD como fallback
    const fallbackResult = await calculateLocalShippingFallback(options.zipcode, options.items);
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
