import { db } from '@/lib/db';
import { retryWithBackoff } from '@/lib/utils/retry';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';

// Configuración de Mercado Libre
const MERCADOLIBRE_API_URL = 'https://api.mercadolibre.com';

interface ShippingItem {
  id: string;
  quantity: number;
  price: number;
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

interface ME2ShippingOption {
  id: string;
  name: string;
  cost: number;
  estimatedDelivery: number;
  shippingMode: string;
  type: string;
}

interface ME2ShippingResult {
  shippingOptions: ME2ShippingOption[];
  cheapestOption?: ME2ShippingOption;
  estimatedDelivery: number;
  totalCost: number;
  currency: string;
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

    const requestBody = {
      zipcode: options.zipcode,
      item_id: firstItem.id,
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
      const res = await fetch(`${MERCADOLIBRE_API_URL}/shipping_options/${firstItem.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new MercadoLibreError(
          MercadoLibreErrorCode.SHIPPING_CALCULATION_FAILED,
          `Error calculando envío ME2: ${error}`,
          { status: res.status, zipcode: options.zipcode, dimensions, itemId: firstItem.id }
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

    const data = await response.json();
    
    // Procesar resultados según la estructura real de la API de ML
    const shippingOptions = data.methods || [];
    const cheapestOption = shippingOptions.length > 0 
      ? shippingOptions.reduce((min: ME2ShippingOption, option: ME2ShippingOption) => 
          (option.cost || 0) < (min.cost || 0) ? option : min
        )
      : null;

    const result: ME2ShippingResult = {
      shippingOptions,
      cheapestOption,
      estimatedDelivery: cheapestOption?.estimated_delivery_time || cheapestOption?.estimated_delivery || 5,
      totalCost: cheapestOption?.cost || 0,
      currency: cheapestOption?.currency_id || 'ARS'
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
    
    // En caso de error, retornar fallback con costo estándar
    const fallbackCost = calculateFallbackShipping(options.zipcode, options.items);
    
    return {
      shippingOptions: [{
        id: 'fallback',
        name: 'Envío estándar (fallback)',
        cost: fallbackCost,
        estimatedDelivery: 5,
        shippingMode: 'standard',
        type: 'standard'
      }],
      cheapestOption: {
        id: 'fallback',
        name: 'Envío estándar (fallback)',
        cost: fallbackCost,
        estimatedDelivery: 5,
        shippingMode: 'standard',
        type: 'standard'
      },
      estimatedDelivery: 5,
      totalCost: fallbackCost,
      currency: 'ARS'
    };
  }
}

// Fallback simple basado en código postal (similar al sistema actual pero mejorado)
function calculateFallbackShipping(zipcode: string, items: ShippingItem[]): number {
  // Lógica básica de fallback según provincia
  const provincePrefix = zipcode.substring(0, 1);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Umbrales de envío gratis por provincia
  const freeShippingThresholds: { [key: string]: number } = {
    '1': 15000, // Buenos Aires
    '2': 20000, // Capital Federal
    '3': 25000, // Catamarca
    '4': 25000, // Córdoba
    '5': 25000, // Corrientes
    '6': 30000, // Chaco
    '7': 30000, // Chubut
    '8': 25000, // Entre Ríos
    '9': 30000, // Formosa
    '0': 30000, // Jujuy
  };

  const threshold = freeShippingThresholds[provincePrefix] || 25000;
  
  if (subtotal >= threshold) {
    return 0;
  }

  // Costo base según provincia
  const baseCosts: { [key: string]: number } = {
    '1': 800,  // Buenos Aires
    '2': 600,  // Capital Federal
    '3': 1200, // Catamarca
    '4': 1000, // Córdoba
    '5': 1100, // Corrientes
    '6': 1300, // Chaco
    '7': 1400, // Chubut
    '8': 1000, // Entre Ríos
    '9': 1350, // Formosa
    '0': 1400, // Jujuy
  };

  return baseCosts[provincePrefix] || 1200;
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
