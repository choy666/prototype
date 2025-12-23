// lib/services/tiendanube-shipping-only.ts
// Servicio simplificado para calcular envíos solo con Tiendanube

import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { createTiendanubeShippingClient, TiendanubeShippingParams } from '@/lib/clients/tiendanube-shipping';
import { decryptString } from '@/lib/utils/encryption';

export interface TiendanubeShippingItem {
  id: string;
  quantity: number;
  price: number;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
}

export interface TiendanubeShippingOption {
  id: string;
  name: string;
  cost: number;
  estimated: string;
  carrier: string;
}

export interface TiendanubeCalculationParams {
  customerZip: string;
  items: TiendanubeShippingItem[];
  subtotal: number;
}

export class TiendanubeShippingService {
  private static instance: TiendanubeShippingService;

  static getInstance(): TiendanubeShippingService {
    if (!this.instance) {
      this.instance = new TiendanubeShippingService();
    }
    return this.instance;
  }

  async calculateShipping(params: TiendanubeCalculationParams): Promise<TiendanubeShippingOption[]> {
    console.log('[Tiendanube Shipping Only] Iniciando cálculo de envío');
    
    // 1. Obtener configuración
    const settings = await db.query.shippingSettings.findFirst();
    
    if (!settings?.tiendanubeEnabled || !settings?.tiendanubeStoreId) {
      console.error('[Tiendanube Shipping Only] Tiendanube no está habilitado');
      return [];
    }

    // 2. Obtener tienda
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, settings.tiendanubeStoreId),
    });

    if (!store) {
      console.error('[Tiendanube Shipping Only] Tienda no encontrada');
      return [];
    }

    console.log('[Tiendanube Shipping Only] Tienda encontrada:', {
      storeId: store.storeId,
      status: store.status
    });

    // 3. Crear cliente
    const client = createTiendanubeShippingClient({
      storeId: settings.tiendanubeStoreId,
      accessToken: decryptString(store.accessTokenEncrypted)
    });

    // 4. Calcular peso y dimensiones totales
    const totalWeight = params.items.reduce((sum, item) => {
      const weight = item.weight || 0;
      console.log(`[Tiendanube Shipping Only] Item ${item.id}: weight=${weight}, quantity=${item.quantity}`);
      return sum + weight * item.quantity;
    }, 0);

    const maxDimensions = params.items.reduce((max, item) => {
      if (!item.dimensions) return max;
      return {
        length: Math.max(max.length, item.dimensions.length),
        width: Math.max(max.width, item.dimensions.width),
        height: Math.max(max.height, item.dimensions.height)
      };
    }, { length: 0, width: 0, height: 0 });

    console.log('[Tiendanube Shipping Only] Totales calculados:', {
      totalWeight,
      dimensions: maxDimensions
    });

    // 5. Preparar parámetros para la API
    const shippingParams: TiendanubeShippingParams = {
      origin_zip: settings.businessZipCode!,
      destination_zip: params.customerZip,
      weight: totalWeight,
      height: maxDimensions.height || undefined,
      width: maxDimensions.width || undefined,
      length: maxDimensions.length || undefined,
      declared_value: params.subtotal
    };

    console.log('[Tiendanube Shipping Only] Parámetros API:', shippingParams);

    // 6. Llamar a la API de Tiendanube
    try {
      const rates = await client.calculateShipping(shippingParams);
      console.log('[Tiendanube Shipping Only] API retornó:', rates.length, 'opciones');

      // 7. Convertir al formato del frontend
      return rates.map(rate => ({
        id: rate.id,
        name: `${rate.carrier_name} - ${rate.service_type}`,
        cost: rate.price,
        estimated: rate.delivery_time.estimated_date || 
                 `${rate.delivery_time.min_days}-${rate.delivery_time.max_days} días`,
        carrier: rate.carrier_name
      }));
    } catch (error) {
      console.error('[Tiendanube Shipping Only] Error en API:', error);
      return [];
    }
  }
}

export const tiendanubeShippingOnly = TiendanubeShippingService.getInstance();
