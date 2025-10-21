import { ShippingMethod } from "@/lib/schema";

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
 * - Método de envío seleccionado
 * - Peso total de los productos
 * - Zona geográfica de destino
 * - Subtotal del pedido (para envío gratis)
 */
export function calculateShippingCost(
  shippingMethod: ShippingMethod,
  totalWeightKg: number,
  province: string,
  subtotal: number
): number {
  // Si el subtotal supera el umbral de envío gratis, costo = 0
  if (shippingMethod.freeThreshold && subtotal >= Number(shippingMethod.freeThreshold)) {
    return 0;
  }

  // Obtener multiplicador de zona (default 1.0 si no está definido)
  const zoneMultiplier = ZONE_MULTIPLIERS[province] || 1.0;

  // Calcular costo base
  let cost = Number(shippingMethod.baseCost);

  // Agregar costo por peso
  cost += totalWeightKg * Number(shippingMethod.weightMultiplier);

  // Aplicar multiplicador de zona
  cost *= zoneMultiplier;

  // Redondear a 2 decimales
  return Math.round(cost * 100) / 100;
}

/**
 * Calcula el peso total de un carrito
 */
export function calculateTotalWeight(items: Array<{
  weight?: number | null;
  quantity: number;
}>): number {
  return items.reduce((total, item) => {
    // Si no tiene peso definido, asumir 0.5kg por defecto
    const weight = item.weight ? Number(item.weight) : 0.5;
    return total + (weight * item.quantity);
  }, 0);
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
