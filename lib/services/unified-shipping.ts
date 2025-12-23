// lib/services/unified-shipping.ts
// Servicio simplificado para calcular envíos con Tiendanube

import { db } from '@/lib/db';
import { orders, tiendanubeStores, products } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { createTiendanubeShippingClient, TiendanubeShippingParams } from '@/lib/clients/tiendanube-shipping';
import { decryptString } from '@/lib/utils/encryption';

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
  type: 'local' | 'tiendanube';
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
    // Forzar recarga siempre para evitar caché stale
    const settings = await db.query.shippingSettings.findFirst();
    
    if (!settings) {
      throw new Error('Configuración de envío no encontrada. Por favor, configure los datos en el panel de administración.');
    }
    
    this.businessSettings = settings;
    return this.businessSettings as Record<string, unknown>;
  }

  async calculateShipping(params: ShippingCalculationParams): Promise<ShippingOption[]> {
    const settings = await this.getBusinessSettings();
    const options: ShippingOption[] = [];

    // Enriquecer items con datos de productos si faltan peso/dimensiones
    const enrichedItems = await this.enrichItemsWithProductData(params.items);

    // 1. Verificar envío local (mismo código postal)
    if (this.isLocalShipping(params.customerZip, settings.businessZipCode as string)) {
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

    // 2. Obtener opciones de Tiendanube
    console.log('[Unified Shipping] Tiendanube enabled:', settings.tiendanubeEnabled);
    console.log('[Unified Shipping] Tiendanube store ID:', settings.tiendanubeStoreId);
    
    if (settings.tiendanubeEnabled) {
      try {
        const tiendanubeOptions = await this.getTiendanubeShippingOptions(
          { ...params, items: enrichedItems }, 
          settings
        );
        options.push(...tiendanubeOptions);
      } catch (error) {
        console.error('[Unified Shipping] Error getting Tiendanube options:', error);
        // No agregar fallback estático - si Tiendanube falla, no mostrar opciones
      }
    }

    // Ordenar por costo
    return options.sort((a, b) => a.cost - b.cost);
  }

  /**
   * Enriquece los items con datos de peso y dimensiones de la BD si no los tienen
   */
  private async enrichItemsWithProductData(items: ShippingItem[]): Promise<ShippingItem[]> {
    const enrichedItems = await Promise.all(items.map(async (item) => {
      // Si ya tiene peso y dimensiones, devolverlo tal cual
      if (item.weight && item.dimensions) {
        return item;
      }

      // Buscar en la BD
      const product = await db.query.products.findFirst({
        where: eq(products.id, parseInt(item.id))
      });

      if (!product) {
        console.warn(`[Unified Shipping] Producto ${item.id} no encontrado`);
        return item;
      }

      // Usar datos del producto (las variantes no tienen peso/dimensiones)
      const source = product;
      
      return {
        ...item,
        weight: source.weight ? Number(source.weight) * 1000 : 0, // Convertir kg a gramos
        dimensions: {
          length: source.length ? Number(source.length) : 0,
          width: source.width ? Number(source.width) : 0,
          height: source.height ? Number(source.height) : 0
        }
      };
    }));

    console.log('[Unified Shipping] Items enriquecidos:', enrichedItems.map(i => ({
      id: i.id,
      weight: i.weight,
      dimensions: i.dimensions
    })));

    return enrichedItems;
  }

  private isLocalShipping(customerZip: string, businessZip: string): boolean {
    // Lógica simple: mismo código postal = envío local
    // Podría expandirse para incluir códigos postales cercanos
    return customerZip === businessZip;
  }

  private async getTiendanubeShippingOptions(
    params: ShippingCalculationParams, 
    settings: Record<string, unknown>
  ): Promise<ShippingOption[]> {
    console.log('[Unified Shipping] getTiendanubeShippingOptions called');
    console.log('[Unified Shipping] Settings:', {
      tiendanubeEnabled: settings.tiendanubeEnabled,
      tiendanubeStoreId: settings.tiendanubeStoreId,
      businessZipCode: settings.businessZipCode
    });
    
    // Obtener tienda de Tiendanube
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, settings.tiendanubeStoreId as string),
    });

    console.log('[Unified Shipping] Tiendanube store found:', !!store);
    if (store) {
      console.log('[Unified Shipping] Store details:', {
        storeId: store.storeId,
        status: store.status,
        hasToken: !!store.accessTokenEncrypted
      });
    }

    if (!store) {
      console.error('[Unified Shipping] Tienda de Tiendanube no configurada');
      throw new Error('Tienda de Tiendanube no configurada');
    }

    // Crear cliente y calcular
    console.log('[Unified Shipping] Creating Tiendanube client...');
    const client = createTiendanubeShippingClient({
      storeId: settings.tiendanubeStoreId as string,
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
      origin_zip: settings.businessZipCode as string,
      destination_zip: params.customerZip,
      weight: totalWeight,
      height: maxDimensions.height || undefined,
      width: maxDimensions.width || undefined,
      length: maxDimensions.length || undefined,
      declared_value: params.subtotal
    };

    console.log('[Unified Shipping] Calling Tiendanube API with params:', shippingParams);
    const tiendanubeOptions = await client.calculateShipping(shippingParams);
    console.log('[Unified Shipping] Tiendanube API returned options:', tiendanubeOptions.length);

    // Convertir al formato unificado
    const unifiedOptions = tiendanubeOptions.map(option => ({
      id: option.id.toString(),
      name: `${option.carrier_name} - ${option.service_type}`,
      cost: option.price,
      estimated: option.delivery_time.estimated_date || `${option.delivery_time.min_days}-${option.delivery_time.max_days} días`,
      type: 'tiendanube' as const,
      carrier: option.carrier_name
    }));

    console.log('[Unified Shipping] Returning Tiendanube options:', unifiedOptions);
    return unifiedOptions;
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
