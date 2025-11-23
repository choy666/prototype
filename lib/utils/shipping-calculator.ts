import type { ShippingMethod } from '@/types';

// Configuración según documentación de Mercado Envíos Argentina
export const SHIPPING_CONFIG = {
  FREE_SHIPPING_THRESHOLD: 5000, // $5.000 para envío gratis
  BASE_COST: 350, // Costo base estándar
  WEIGHT_RATE: 0.05, // $50 por kg adicional
  SIZE_SURCHARGE: 100, // Recargo por tamaño grande
  PROVINCE_MULTIPLIERS: {
    'Buenos Aires': 1.0,
    'Capital Federal': 1.0,
    'Córdoba': 1.2,
    'Santa Fe': 1.2,
    'Entre Ríos': 1.3,
    'Mendoza': 1.4,
    'San Juan': 1.4,
    'San Luis': 1.4,
    'La Pampa': 1.5,
    'Neuquén': 1.6,
    'Río Negro': 1.6,
    'Chubut': 1.7,
    'Santa Cruz': 1.8,
    'Tierra del Fuego': 2.0,
    'Formosa': 1.5,
    'Chaco': 1.5,
    'Corrientes': 1.4,
    'Misiones': 1.6,
    'Salta': 1.6,
    'Jujuy': 1.7,
    'Tucumán': 1.4,
    'Catamarca': 1.5,
    'La Rioja': 1.5,
    'Santiago del Estero': 1.5,
  },
} as const;

// Métodos de envío disponibles según Mercado Envíos
export const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: 1,
    name: 'Mercado Envíos Normal',
    description: 'Entrega estándar en 3-5 días hábiles',
    cost: SHIPPING_CONFIG.BASE_COST,
    estimatedDays: 3,
    type: 'standard',
    freeShippingThreshold: SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD,
  },
  {
    id: 2,
    name: 'Mercado Envíos Express',
    description: 'Entrega rápida en 1-2 días hábiles',
    cost: SHIPPING_CONFIG.BASE_COST * 1.5,
    estimatedDays: 1,
    type: 'express',
    freeShippingThreshold: SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD * 1.2,
  },
  {
    id: 3,
    name: 'Retiro en sucursal',
    description: 'Retira gratis en nuestra sucursal',
    cost: 0,
    estimatedDays: 0,
    type: 'pickup',
    freeShippingThreshold: 0,
  },
];

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  weight?: number | null;
  discount?: number;
  variantId?: number;
}

export interface ShippingAddress {
  street: string;
  number: string;
  city: string;
  province: string;
  postalCode: string;
  floor?: string;
  apartment?: string;
}

/**
 * Calcula el peso total de los items del carrito
 * Si no hay peso definido, usa 500g por defecto por producto
 */
export function calculateTotalWeight(items: CartItem[]): number {
  return items.reduce((total, item) => {
    const itemWeight = item.weight || 0.5; // 500g por defecto
    return total + (itemWeight * item.quantity);
  }, 0);
}

/**
 * Calcula el costo de envío según reglas de Mercado Envíos Argentina
 */
export function calculateShippingCost(
  shippingMethod: ShippingMethod,
  totalWeight: number,
  province: string,
  subtotal: number
): number {
  // Retiro en sucursal siempre gratis
  if (shippingMethod.type === 'pickup') {
    return 0;
  }

  // Envío gratis si supera el umbral
  if (subtotal >= (shippingMethod.freeShippingThreshold || 0)) {
    return 0;
  }

  // Costo base
  let cost = shippingMethod.cost;

  // Multiplicador por provincia
  const provinceMultiplier = SHIPPING_CONFIG.PROVINCE_MULTIPLIERS[province as keyof typeof SHIPPING_CONFIG.PROVINCE_MULTIPLIERS] || 1.5;
  cost *= provinceMultiplier;

  // Recargo por peso adicional (después de 1kg)
  if (totalWeight > 1) {
    const extraWeight = totalWeight - 1;
    cost += extraWeight * SHIPPING_CONFIG.WEIGHT_RATE * 100; // Convertir a pesos
  }

  // Recargo por envíos pesados (> 5kg)
  if (totalWeight > 5) {
    cost += SHIPPING_CONFIG.SIZE_SURCHARGE;
  }

  // Redondear a 2 decimales
  return Math.round(cost * 100) / 100;
}

/**
 * Obtiene métodos de envío disponibles para una dirección y subtotal
 */
export function getAvailableShippingMethods(
  address: ShippingAddress,
  subtotal: number
): ShippingMethod[] {
  return SHIPPING_METHODS.map(method => ({
    ...method,
    cost: calculateShippingCost(
      method,
      1, // Punto de partida, se calcula por item real
      address.province,
      subtotal
    ),
  }));
}

/**
 * Valida si un código postal es válido según formato argentino
 */
export function isValidPostalCode(postalCode: string): boolean {
  // Formatos válidos: 1234, C1234, C1234ABC, A1234BCD
  const postalCodeRegex = /^[A-Z]?\d{4}[A-Z]{0,3}$/;
  return postalCodeRegex.test(postalCode.toUpperCase());
}

/**
 * Normaliza el nombre de una provincia para coincidir con las configuraciones
 */
export function normalizeProvinceName(province: string): string {
  const provinceMappings: Record<string, string> = {
    'caba': 'Capital Federal',
    'capital federal': 'Capital Federal',
    'buenos aires': 'Buenos Aires',
    'cordoba': 'Córdoba',
    'santa fe': 'Santa Fe',
    'mendoza': 'Mendoza',
    'tucuman': 'Tucumán',
    'entre rios': 'Entre Ríos',
    'corrientes': 'Corrientes',
    'santiago del estero': 'Santiago del Estero',
    'salta': 'Salta',
    'jujuy': 'Jujuy',
    'rio negro': 'Río Negro',
    'chubut': 'Chubut',
    'neuquen': 'Neuquén',
    'formosa': 'Formosa',
    'chaco': 'Chaco',
    'misiones': 'Misiones',
    'la pampa': 'La Pampa',
    'san luis': 'San Luis',
    'san juan': 'San Juan',
    'la rioja': 'La Rioja',
    'catamarca': 'Catamarca',
    'santa cruz': 'Santa Cruz',
    'tierra del fuego': 'Tierra del Fuego',
  };

  const normalized = province.toLowerCase().trim();
  return provinceMappings[normalized] || province;
}

/**
 * Calcula tiempo estimado de entrega basado en provincia y método
 */
export function calculateEstimatedDays(
  shippingMethod: ShippingMethod,
  province: string
): number {
  if (shippingMethod.type === 'pickup') {
    return 0;
  }

  const baseDays = shippingMethod.estimatedDays || 3;
  
  // Días adicionales por provincia
  const provinceDelays: Record<string, number> = {
    'Tierra del Fuego': 3,
    'Santa Cruz': 3,
    'Chubut': 2,
    'Río Negro': 2,
    'Neuquén': 2,
    'Mendoza': 1,
    'San Juan': 1,
    'Jujuy': 1,
    'Salta': 1,
    'Formosa': 1,
    'Chaco': 1,
    'Misiones': 1,
  };

  const additionalDays = provinceDelays[province] || 0;
  return baseDays + additionalDays;
}
