import { ShippingMethod } from "@/lib/schema";

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  weight?: number | null;
  discount?: number;
  variantId?: number;
}

// Interfaz para métodos de envío del formulario de checkout
export interface CheckoutShippingMethod {
  id: number;
  name: string;
  cost: number;
  description?: string;
  estimatedDays?: number;
  type?: 'standard' | 'express' | 'pickup';
  freeShippingThreshold?: number;
  freeThreshold?: number | null; // Para compatibilidad con ShippingMethod
}

// Zonas geográficas de Argentina con multiplicadores
const ZONE_MULTIPLIERS: Record<string, number> = {
  // Zona Centro (Buenos Aires y alrededores) - costo base
  'Buenos Aires': 1.0,
  'Capital Federal': 1.0,

  // Zona Norte - costo +20%
  'Catamarca': 1.2,
  'Chaco': 1.2,
  'Chubut': 1.2,
  'Corrientes': 1.2,
  'Entre Ríos': 1.2,
  'Formosa': 1.2,
  'Jujuy': 1.2,
  'La Pampa': 1.2,
  'La Rioja': 1.2,
  'Mendoza': 1.2,
  'Misiones': 1.2,
  'Neuquén': 1.2,
  'Río Negro': 1.2,
  'Salta': 1.2,
  'San Juan': 1.2,
  'San Luis': 1.2,
  'Santa Fe': 1.2,
  'Santiago del Estero': 1.2,
  'Tucumán': 1.2,

  // Zona Sur (Patagonia) - costo +40%
  'Santa Cruz': 1.4,
  'Tierra del Fuego': 1.4,
};

/**
 * Calcula el costo de envío basado en:
 * - Método de envío seleccionado (desde base de datos)
 * - Peso total de los productos
 * - Zona geográfica de destino
 * - Subtotal del pedido (para envío gratis)
 */
export function calculateShippingCost(
  shippingMethod: ShippingMethod,
  totalWeightKg: number,
  province: string,
  subtotal: number
): number;

/**
 * Calcula el costo de envío basado en:
 * - Método de envío seleccionado (desde formulario checkout)
 * - Peso total de los productos
 * - Zona geográfica de destino
 * - Subtotal del pedido (para envío gratis)
 */
export function calculateShippingCost(
  shippingMethod: CheckoutShippingMethod,
  totalWeightKg: number,
  province: string,
  subtotal: number
): number;

export function calculateShippingCost(
  shippingMethod: ShippingMethod | CheckoutShippingMethod,
  totalWeightKg: number,
  province: string,
  subtotal: number
): number {
  // Retiro en sucursal siempre gratis
  if ('type' in shippingMethod && shippingMethod.type === 'pickup') {
    return 0;
  }

  // Envío gratis si supera el umbral
  const freeThreshold = 'freeThreshold' in shippingMethod 
    ? shippingMethod.freeThreshold 
    : shippingMethod.freeThreshold ? Number(shippingMethod.freeThreshold) : null;
    
  if (freeThreshold && subtotal >= Number(freeThreshold)) {
    return 0;
  }

  // Calcular costo base según el tipo de método
  let cost: number;
  
  if ('cost' in shippingMethod) {
    // Es CheckoutShippingMethod
    cost = shippingMethod.cost;
    
    // Aplicar multiplicador de provincia
    const provinceMultiplier = ZONE_MULTIPLIERS[province] || 1.5;
    cost *= provinceMultiplier;
    
    // Recargo por peso adicional (después de 1kg)
    if (totalWeightKg > 1) {
      const extraWeight = totalWeightKg - 1;
      cost += extraWeight * 50; // $50 por kg adicional
    }
    
    // Recargo por envíos pesados (> 5kg)
    if (totalWeightKg > 5) {
      cost += 100;
    }
  } else {
    // Es ShippingMethod de la base de datos
    cost = Number(shippingMethod.baseCost);
    
    // Aplicar multiplicador de peso
    cost += totalWeightKg * Number(shippingMethod.weightMultiplier);

    // Aplicar multiplicador de zona
    const zoneMultiplier = ZONE_MULTIPLIERS[province] || 1.0;
    cost *= zoneMultiplier;
  }

  // Redondear a 2 decimales
  return Math.round(cost * 100) / 100;
}

/**
 * Obtiene el multiplicador de zona para una provincia
 */
export function getZoneMultiplier(province: string): number {
  return ZONE_MULTIPLIERS[province] || 1.0;
}

/**
 * Verifica si un envío es gratis basado en el subtotal
 */
export function isFreeShipping(shippingMethod: ShippingMethod, subtotal: number): boolean {
  return Boolean(shippingMethod.freeThreshold && subtotal >= Number(shippingMethod.freeThreshold));
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
