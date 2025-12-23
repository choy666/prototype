// lib/clients/tiendanube-shipping.ts
// Cliente actualizado para usar la API oficial de Tiendanube

export interface TiendanubeShippingParams {
  origin_zip: string;
  destination_zip: string;
  weight: number; // gramos
  height?: number; // cm
  width?: number; // cm
  length?: number; // cm
  declared_value?: number;
}

export interface TiendanubeCarrier {
  id: string;
  name: string;
  code: string;
  carrier_type: 'custom' | 'shipping_carrier' | 'pickup_point';
  shipping_class_id?: string;
  enabled: boolean;
  coverage?: {
    zip_codes?: string[];
    countries?: string[];
  };
}

export interface TiendanubeShippingRate {
  id: string;
  carrier_name: string;
  carrier_code: string;
  price: number;
  delivery_time: {
    min_days: number;
    max_days: number;
    estimated_date?: string;
  };
  service_type: string;
  coverage: boolean;
}

export class TiendanubeShippingClient {
  private storeId: string;
  private accessToken: string;
  private baseUrl = 'https://api.tiendanube.com/v1';

  constructor({ storeId, accessToken }: { storeId: string; accessToken: string }) {
    this.storeId = storeId;
    this.accessToken = accessToken;
  }

  /**
   * Obtiene los transportistas configurados en la tienda
   */
  async getCarriers(): Promise<TiendanubeCarrier[]> {
    console.log('[Tiendanube Shipping] Fetching carriers for store:', this.storeId);
    
    const response = await fetch(`${this.baseUrl}/${this.storeId}/shipping_carriers`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Technocat-Integration/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const carriers = await response.json();
    console.log('[Tiendanube Shipping] Found carriers:', carriers.length);
    
    return carriers.map((carrier: {
      id: string;
      name: string;
      code: string;
      carrier_type: string;
      shipping_class_id?: string;
      enabled: boolean;
      coverage?: object;
    }) => ({
      id: carrier.id,
      name: carrier.name,
      code: carrier.code,
      carrier_type: carrier.carrier_type,
      shipping_class_id: carrier.shipping_class_id,
      enabled: carrier.enabled,
      coverage: carrier.coverage
    }));
  }

  /**
   * Calcula las tarifas de envío para todos los transportistas disponibles
   */
  async calculateShipping(params: TiendanubeShippingParams): Promise<TiendanubeShippingRate[]> {
    console.log('[Tiendanube Shipping] Calculating shipping with params:', {
      origin: params.origin_zip,
      destination: params.destination_zip,
      weight: params.weight,
      dimensions: { length: params.length, width: params.width, height: params.height }
    });

    const carriers = await this.getCarriers();
    const rates: TiendanubeShippingRate[] = [];

    // Para cada carrier, intentar calcular la tarifa
    for (const carrier of carriers) {
      if (!carrier.enabled) continue;

      try {
        const rate = await this.calculateCarrierRate(carrier, params);
        if (rate && rate.coverage) {
          rates.push(rate);
        }
      } catch (error) {
        console.warn(`[Tiendanube Shipping] Error calculating rate for ${carrier.name}:`, error);
        // Continuar con el siguiente carrier
      }
    }

    // Agregar siempre opción de retiro en local si está disponible
    if (carriers.some(c => c.carrier_type === 'pickup_point')) {
      rates.push({
        id: 'local-pickup',
        carrier_name: 'Retiro en Local',
        carrier_code: 'pickup',
        price: 0,
        delivery_time: {
          min_days: 0,
          max_days: 1
        },
        service_type: 'pickup',
        coverage: true
      });
    }

    console.log('[Tiendanube Shipping] Returning rates:', rates.length);
    return rates.sort((a, b) => a.price - b.price);
  }

  /**
   * Calcula la tarifa para un transportista específico
   */
  private async calculateCarrierRate(
    carrier: TiendanubeCarrier,
    params: TiendanubeShippingParams
  ): Promise<TiendanubeShippingRate | null> {
    // Para carriers tipo "pickup_point", el cálculo es diferente
    if (carrier.carrier_type === 'pickup_point') {
      return {
        id: carrier.id,
        carrier_name: carrier.name,
        carrier_code: carrier.code,
        price: 0,
        delivery_time: {
          min_days: 0,
          max_days: 1
        },
        service_type: 'pickup',
        coverage: true
      };
    }

    // Para carriers estándar, usar el endpoint de rates
    const rateParams = {
      destination_zip: params.destination_zip,
      weight: params.weight,
      height: params.height,
      width: params.width,
      length: params.length,
      declared_value: params.declared_value || 0,
      items_count: 1
    };

    const response = await fetch(
      `${this.baseUrl}/${this.storeId}/shipping_carriers/${carrier.id}/rates`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Technocat-Integration/1.0'
        },
        body: JSON.stringify(rateParams)
      }
    );

    if (!response.ok) {
      // Si el carrier no soporta el endpoint de rates, devolver null
      if (response.status === 404 || response.status === 405) {
        console.warn(`[Tiendanube Shipping] Carrier ${carrier.name} doesn't support rates endpoint`);
        return null;
      }
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const rateData = await response.json();
    
    // Mapear la respuesta al formato esperado
    return {
      id: carrier.id,
      carrier_name: carrier.name,
      carrier_code: carrier.code,
      price: rateData.price || rateData.cost || 0,
      delivery_time: {
        min_days: rateData.min_delivery_days || 1,
        max_days: rateData.max_delivery_days || 3,
        estimated_date: rateData.estimated_date
      },
      service_type: rateData.service_type || 'standard',
      coverage: rateData.coverage !== false
    };
  }
}

export function createTiendanubeShippingClient(params: { storeId: string; accessToken: string }) {
  return new TiendanubeShippingClient(params);
}
