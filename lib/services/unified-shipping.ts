// lib/services/unified-shipping.ts
// Servicio unificado para calcular envíos locales, Tiendanube y Mercado Envíos 2

import { db } from '@/lib/db';
import { orders, tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { createTiendanubeShippingClient, TiendanubeShippingParams } from '@/lib/clients/tiendanube-shipping';
import { decryptString } from '@/lib/utils/encryption';
import { calculateME2ShippingCost } from '@/lib/actions/me2-shipping';

export interface ShippingItem {
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

export interface ShippingOption {
  id: string;
  name: string;
  cost: number;
  estimated: string;
  type: 'local' | 'tiendanube' | 'me2';
  carrier?: string;
}

export interface ShippingCalculationParams {
  customerZip: string;
  items: ShippingItem[];
  subtotal: number;
}

export class UnifiedShippingService {
  private static instance: UnifiedShippingService;
  private businessSettings: Record<string, unknown> | null = null;

  static getInstance(): UnifiedShippingService {
    if (!this.instance) {
      this.instance = new UnifiedShippingService();
    }
    return this.instance;
  }

  async getBusinessSettings(): Promise<Record<string, unknown>> {
    if (!this.businessSettings) {
      const settings = await db.query.shippingSettings.findFirst();
      
      if (!settings) {
        throw new Error('Configuración de envío no encontrada. Por favor, configure los datos en el panel de administración.');
      }
      
      this.businessSettings = settings;
    }
    return this.businessSettings as Record<string, unknown>;
  }

  async calculateShipping(params: ShippingCalculationParams): Promise<ShippingOption[]> {
    const settings = await this.getBusinessSettings();
    const options: ShippingOption[] = [];

    // 1. Verificar envío local (mismo código postal)
    if (this.isLocalShipping(params.customerZip, settings.business_zip_code as string)) {
      const localCost = params.subtotal >= (settings.free_shipping_threshold as number) 
        ? 0 
        : (settings.local_shipping_cost as number);

      options.push({
        id: 'local',
        name: localCost === 0 ? 'Envío GRATIS' : 'Retiro en sucursal',
        cost: localCost,
        estimated: ' Hoy o mañana',
        type: 'local',
        carrier: 'Local'
      });
    }

    // 2. Obtener opciones de ME2 y Tiendanube en paralelo
    const [me2Options, tiendanubeOptions] = await Promise.allSettled([
      this.getME2ShippingOptions(params),
      settings.tiendanube_enabled ? this.getTiendanubeShippingOptions(params, settings) : []
    ]);

    // 3. Procesar opciones de ME2
    if (me2Options.status === 'fulfilled') {
      options.push(...me2Options.value);
    } else {
      console.error('[Unified Shipping] Error getting ME2 options:', me2Options.reason);
    }

    // 4. Procesar opciones de Tiendanube
    if (tiendanubeOptions.status === 'fulfilled') {
      options.push(...tiendanubeOptions.value);
    } else {
      console.error('[Unified Shipping] Error getting Tiendanube options:', tiendanubeOptions.reason);
      // No agregar fallback estático - si Tiendanube falla, no mostrar opciones
    }

    // Ordenar por costo
    return options.sort((a, b) => a.cost - b.cost);
  }

  private isLocalShipping(customerZip: string, businessZip: string): boolean {
    // Lógica simple: mismo código postal = envío local
    // Podría expandirse para incluir códigos postales cercanos
    return customerZip === businessZip;
  }

  private async getME2ShippingOptions(params: ShippingCalculationParams): Promise<ShippingOption[]> {
    try {
      const me2Result = await calculateME2ShippingCost({
        zipcode: params.customerZip,
        items: params.items.map(item => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price
        }))
      });

      // Convertir opciones de ME2 al formato unificado
      return me2Result.shippingOptions
        .filter(option => (option.deliver_to ?? 'address') === 'address') // Solo envíos a domicilio
        .map(option => ({
          id: option.shipping_method_id?.toString() || 'me2-' + option.name,
          name: option.name,
          cost: option.cost,
          estimated: option.estimated_delivery?.date 
            ? new Date(option.estimated_delivery.date).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'short'
              })
            : '3-5 días',
          type: 'me2' as const,
          carrier: 'Mercado Envíos'
        }));
    } catch (error) {
      console.error('[Unified Shipping] ME2 error:', error);
      return [];
    }
  }

  private async getTiendanubeShippingOptions(
    params: ShippingCalculationParams, 
    settings: Record<string, unknown>
  ): Promise<ShippingOption[]> {
    // Obtener tienda de Tiendanube
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, settings.tiendanube_store_id as string),
    });

    if (!store) {
      throw new Error('Tienda de Tiendanube no configurada');
    }

    // Crear cliente y calcular
    const client = createTiendanubeShippingClient({
      storeId: settings.tiendanube_store_id as string,
      accessToken: decryptString(store.accessTokenEncrypted)
    });

    // Calcular peso y dimensiones totales de los items
    const totalWeight = params.items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);
    const maxDimensions = params.items.reduce((max, item) => {
      if (!item.dimensions) return max;
      return {
        length: Math.max(max.length, item.dimensions.length),
        width: Math.max(max.width, item.dimensions.width),
        height: Math.max(max.height, item.dimensions.height)
      };
    }, { length: 0, width: 0, height: 0 });

    const shippingParams: TiendanubeShippingParams = {
      origin_zip: settings.business_zip_code as string,
      destination_zip: params.customerZip,
      weight: totalWeight,
      height: maxDimensions.height || undefined,
      width: maxDimensions.width || undefined,
      length: maxDimensions.length || undefined,
      declared_value: params.subtotal
    };

    const tiendanubeOptions = await client.calculateShipping(shippingParams);

    return tiendanubeOptions.map((option: {
      id: string;
      name: string;
      price: number;
      deliveryTime: string;
      carrier: string;
    }) => ({
      id: option.id,
      name: option.name,
      cost: option.price,
      estimated: option.deliveryTime,
      type: 'tiendanube' as const,
      carrier: option.carrier
    }));
  }

  async saveShippingToOrder(orderId: number, shippingOption: ShippingOption, address: Record<string, unknown>) {
    // Guardar información de envío en la orden
    await db.update(orders)
      .set({
        shippingMethodId: shippingOption.id === 'local' ? 1 : (typeof shippingOption.id === 'number' ? shippingOption.id : Number(shippingOption.id) || 1),
        shippingCost: shippingOption.cost.toString(),
        shippingAddress: address as Record<string, unknown>,
        shippingStatus: 'pending',
        metadata: {
          carrier: shippingOption.carrier,
          estimatedDelivery: this.calculateEstimatedDate(shippingOption.estimated),
          shippingType: shippingOption.type
        }
      })
      .where(eq(orders.id, orderId));
  }

  private calculateEstimatedDate(estimated: string): Date {
    // Convertir "3-5 días" a fecha estimada
    const days = parseInt(estimated.match(/\d+/)?.[0] || '5');
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }
}

// Exportar instancia singleton
export const unifiedShipping = UnifiedShippingService.getInstance();
