// lib/services/unified-shipping.ts
// Servicio simplificado para calcular envíos con Tiendanube

import { db } from '@/lib/db';
import { orders, tiendanubeStores, products } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import {
  buildQuoteKey,
  getOrCreateQuote,
  LocalQuoteItemInput,
  QuoteSignatureItem,
} from '@/lib/services/tiendanube-shipping-quotes';
import { buildLocalCartId } from '@/lib/utils/shipping-quote';

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
  quoteKey?: string;
  cartId?: string;
  quoteSource?: string;
  quoteExpiresAt?: string;
  ttlSeconds?: number;
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
    
    const storeId = settings.tiendanubeStoreId as string | undefined;
    if (!storeId) {
      throw new Error('No hay tienda de Tiendanube configurada en shipping settings.');
    }

    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, storeId),
    });

    if (!store || store.status !== 'connected') {
      throw new Error('Tienda de Tiendanube no conectada. Reconecta desde el panel de administración.');
    }

    const signatureItems: QuoteSignatureItem[] = params.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      grams: item.weight ?? 0,
      price: item.price ?? 0,
    }));

    const localItems: LocalQuoteItemInput[] = params.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price ?? 0,
      weightGrams: item.weight ?? 0,
      dimensions: item.dimensions ?? undefined,
    }));

    const quoteKey = buildQuoteKey({
      storeId,
      destinationZip: params.customerZip,
      items: signatureItems,
    });

    const cartId = buildLocalCartId(
      params.customerZip,
      params.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price ?? 0,
      }))
    );

    console.log('[Unified Shipping] Quote key generated:', quoteKey);
    console.log('[Unified Shipping] Cart ID generated:', cartId);

    const quote = await getOrCreateQuote({
      quoteKey,
      destinationZip: params.customerZip,
      items: localItems,
      storeId,
      cartId,
      source: 'local',
    });

    console.log('[Unified Shipping] Quote source:', quote.source, 'options:', quote.options.length);

    const expiresAt = quote.expiresAt instanceof Date
      ? quote.expiresAt
      : new Date(quote.expiresAt);
    const ttlSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

    const metadata = {
      quoteKey: quote.quoteKey,
      cartId: quote.cartId ?? cartId,
      quoteSource: quote.source,
      quoteExpiresAt: expiresAt.toISOString(),
      ttlSeconds,
    };

    const unifiedOptions = quote.options.map((option) => ({
      id: option.id.toString(),
      name: `${option.carrier_name} - ${option.name}`,
      cost: option.cost,
      estimated: option.estimated_delivery,
      type: 'tiendanube' as const,
      carrier: option.carrier_name,
      quoteKey: metadata.quoteKey,
      cartId: metadata.cartId,
      quoteSource: metadata.quoteSource,
      quoteExpiresAt: metadata.quoteExpiresAt,
      ttlSeconds: metadata.ttlSeconds,
    }));

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
