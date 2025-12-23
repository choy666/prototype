// lib/clients/tiendanube-shipping.ts
// Cliente para Envío Nube de Tiendanube

import { createTiendanubeClient } from '@/lib/clients/tiendanube';
import { tiendanubeTokenManager } from '@/lib/services/tiendanube-token-manager';

export interface TiendanubeShippingOption {
  id: string;
  name: string;
  price: number;
  deliveryTime: string;
  carrier: string;
}

export interface TiendanubeShippingParams {
  origin_zip: string;
  destination_zip: string;
  weight: number; // en gramos
  height?: number;
  width?: number;
  length?: number;
  declared_value?: number;
}

export class TiendanubeShippingClient {
  private storeId: string;
  private accessToken: string;
  private config: ReturnType<typeof createTiendanubeClient>;

  constructor(params: { storeId: string; accessToken: string }) {
    this.storeId = params.storeId;
    this.accessToken = params.accessToken;
    this.config = createTiendanubeClient(params);
  }

  async calculateShipping(params: TiendanubeShippingParams) {
    try {
      // Verificar estado del token antes de hacer la llamada
      const tokenStatus = await tiendanubeTokenManager.validateToken(this.storeId);
      
      if (!tokenStatus.valid) {
        console.warn(`[Tiendanube] Token inválido para store ${this.storeId}, necesita reautenticación`);
        return [];
      }

      // Primero obtener lista de transportistas disponibles
      const carriersUrl = `https://api.tiendanube.com/v1/${this.storeId}/shipping_carriers`;
      const carriersResponse = await fetch(carriersUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Prototype-Store/1.0',
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      // Manejar error de autenticación
      if (carriersResponse.status === 401) {
        await tiendanubeTokenManager.handleAuthError(this.storeId, { status: 401 });
        return [];
      }

      if (!carriersResponse.ok) {
        throw new Error(`Error ${carriersResponse.status}: ${carriersResponse.statusText}`);
      }

      const carriers = await carriersResponse.json();
      
      // Calcular tasas para cada transportista
      const shippingOptions = await Promise.all(
        carriers.map(async (carrier: { id: string; name: string }) => {
          const ratesUrl = `https://api.tiendanube.com/v1/${this.storeId}/shipping_carriers/${carrier.id}/rates`;
          
          const ratesResponse = await fetch(ratesUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Prototype-Store/1.0',
              'Authorization': `Bearer ${this.accessToken}`
            },
            body: JSON.stringify({
              origin_zip: params.origin_zip,
              destination_zip: params.destination_zip,
              weight: params.weight,
              height: params.height,
              width: params.width,
              length: params.length,
              declared_value: params.declared_value
            })
          });

          // Manejar error de autenticación en rates
          if (ratesResponse.status === 401) {
            await tiendanubeTokenManager.handleAuthError(this.storeId, { status: 401 });
            return null;
          }

          if (!ratesResponse.ok) {
            console.error(`[Tiendanube] Error calculating rate for ${carrier.name}:`, ratesResponse.status);
            return null;
          }

          const rateData = await ratesResponse.json();
          
          return {
            id: carrier.id,
            name: carrier.name,
            price: rateData.price || 0,
            deliveryTime: rateData.delivery_time || '3-5 días hábiles',
            carrier: carrier.name
          };
        })
      );

      // Filtrar nulos y devolver solo opciones con precio real
      return shippingOptions.filter(option => option !== null && option.price >= 0);

    } catch (error) {
      // Verificar si es error de autenticación
      const isAuthError = await tiendanubeTokenManager.handleAuthError(
        this.storeId, 
        error instanceof Error ? error : { status: undefined, message: String(error) }
      );
      
      if (isAuthError) {
        console.warn('[Tiendanube Shipping] Error de autenticación - se requiere reconexión');
        return [];
      }
      
      console.error('[Tiendanube Shipping] Error:', error);
      
      // No hay datos disponibles - devolver array vacío
      // Nunca usar datos estáticos/hardcoded
      return [];
    }
  }
}

export function createTiendanubeShippingClient(params: { storeId: string; accessToken: string }) {
  return new TiendanubeShippingClient(params);
}
