// lib/services/tiendanube-webhook-service.ts
// Servicio para manejar el modelo webhook de Tiendanube

import { getZoneByPostalCode, SHIPPING_CONFIG } from '@/lib/config/shipping-zones';

export interface TiendanubeWebhookItem {
  id: number;
  product_id: number;
  name: string;
  sku?: string;
  quantity: number;
  free_shipping: boolean;
  grams: number;
  price: number;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
}

export interface TiendanubeWebhookRequest {
  cart_id: string;
  store_id: number;
  currency: string;
  language: string;
  origin: {
    postal_code: string;
    address?: string;
    city?: string;
    province?: string;
    country: string;
  };
  destination: {
    postal_code: string;
    address?: string;
    city?: string;
    province?: string;
    country: string;
  };
  items: TiendanubeWebhookItem[];
  carrier: {
    id: string;
    name: string;
    options: Array<{
      id: string;
      name: string;
      code: string;
      allow_free_shipping: boolean;
      additional_cost: {
        amount: number;
        currency: string;
      };
      additional_days: number;
    }>;
  };
}

export interface TiendanubeShippingOption {
  id: string;
  name: string;
  code: string;
  cost: number;
  currency: string;
  estimated_delivery: string;
  carrier_name: string;
}

export class TiendanubeWebhookService {
  private static instance: TiendanubeWebhookService;

  static getInstance(): TiendanubeWebhookService {
    if (!this.instance) {
      this.instance = new TiendanubeWebhookService();
    }
    return this.instance;
  }

  async calculateShippingRates(
    request: TiendanubeWebhookRequest
  ): Promise<TiendanubeShippingOption[]> {
    console.log('[Tiendanube Webhook] Calculating rates for store:', request.store_id);
    
    const options: TiendanubeShippingOption[] = [];
    
    // Calcular totales
    const totals = this.calculateTotals(request.items);
    
    // 1. Envío local (si aplica)
    if (this.isLocalShipping(request.origin.postal_code, request.destination.postal_code)) {
      options.push({
        id: 'local-pickup',
        name: 'Retiro en sucursal',
        code: 'pickup',
        cost: 0,
        currency: request.currency,
        estimated_delivery: 'Hoy o mañana',
        carrier_name: 'Local'
      });
    }

    // 2. Opciones de carrier configuradas
    for (const carrierOption of request.carrier.options) {
      const option = await this.calculateCarrierRate(
        carrierOption,
        request,
        totals
      );
      if (option) {
        options.push(option);
      }
    }

    return options.sort((a, b) => a.cost - b.cost);
  }

  private calculateTotals(items: TiendanubeWebhookItem[]) {
    return {
      totalWeight: items.reduce((sum, item) => sum + (item.grams * item.quantity), 0),
      totalValue: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      maxDimensions: items.reduce((max, item) => ({
        width: Math.max(max.width, item.dimensions.width),
        height: Math.max(max.height, item.dimensions.height),
        depth: Math.max(max.depth, item.dimensions.depth)
      }), { width: 0, height: 0, depth: 0 }),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
    };
  }

  private isLocalShipping(originZip: string, destinationZip: string): boolean {
    return originZip === destinationZip;
  }

  private async calculateCarrierRate(
    carrierOption: TiendanubeWebhookRequest['carrier']['options'][0],
    request: TiendanubeWebhookRequest,
    totals: {
      totalWeight: number;
      totalValue: number;
      maxDimensions: { width: number; height: number; depth: number };
      itemCount: number;
    }
  ): Promise<TiendanubeShippingOption | null> {
    // Obtener zona y costo base dinámicamente
    const zone = getZoneByPostalCode(request.destination.postal_code);
    let baseCost = zone.baseCost;
    
    // Ajustes por peso (configurables)
    if (totals.totalWeight > SHIPPING_CONFIG.weightSurcharge.threshold) {
      const extraWeight = totals.totalWeight - SHIPPING_CONFIG.weightSurcharge.threshold;
      const surchargeUnits = Math.floor(extraWeight / SHIPPING_CONFIG.weightSurcharge.threshold);
      baseCost += surchargeUnits * SHIPPING_CONFIG.weightSurcharge.surcharge;
    }
    
    // Ajustes por dimensiones (configurables)
    const volume = totals.maxDimensions.width * totals.maxDimensions.height * totals.maxDimensions.depth;
    if (volume > SHIPPING_CONFIG.volumeSurcharge.threshold) {
      baseCost += SHIPPING_CONFIG.volumeSurcharge.surcharge;
    }
    
    // Agregar costo adicional del carrier
    const finalCost = baseCost + carrierOption.additional_cost.amount;
    
    // Calcular días de entrega
    const estimatedDays = zone.additionalDays + carrierOption.additional_days;
    
    // Free shipping si corresponde (configurable)
    const isFreeShipping = totals.totalValue >= SHIPPING_CONFIG.freeShippingThreshold && 
                          carrierOption.allow_free_shipping;
    const finalPrice = isFreeShipping ? 0 : finalCost;
    
    return {
      id: carrierOption.id,
      name: carrierOption.name,
      code: carrierOption.code,
      cost: finalPrice,
      currency: request.currency,
      estimated_delivery: `${estimatedDays}-${estimatedDays + 2} días`,
      carrier_name: request.carrier.name
    };
  }
}

export const tiendanubeWebhookService = TiendanubeWebhookService.getInstance();
