// lib/config/shipping-zones.ts
// Configuración de zonas y costos de envío dinámicos

export interface ShippingZone {
  prefix: string;
  name: string;
  baseCost: number;
  additionalDays: number;
}

export interface ShippingConfig {
  zones: ShippingZone[];
  freeShippingThreshold: number;
  weightSurcharge: {
    threshold: number;
    surcharge: number;
  };
  volumeSurcharge: {
    threshold: number;
    surcharge: number;
  };
}

export const SHIPPING_CONFIG: ShippingConfig = {
  zones: [
    {
      prefix: '1',
      name: 'Capital y GBA',
      baseCost: 1500,
      additionalDays: 0
    },
    {
      prefix: '2',
      name: 'Interior pampeano',
      baseCost: 2500,
      additionalDays: 2
    },
    {
      prefix: '3',
      name: 'Interior pampeano',
      baseCost: 2500,
      additionalDays: 2
    }
  ],
  freeShippingThreshold: 50000,
  weightSurcharge: {
    threshold: 1000,
    surcharge: 500
  },
  volumeSurcharge: {
    threshold: 10000,
    surcharge: 1000
  }
};

export function getZoneByPostalCode(postalCode: string): ShippingZone {
  const zone = SHIPPING_CONFIG.zones.find(z => postalCode.startsWith(z.prefix));
  return zone || {
    prefix: 'other',
    name: 'Resto del país',
    baseCost: 3500,
    additionalDays: 4
  };
}
