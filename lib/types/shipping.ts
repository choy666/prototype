// Interfaces para métodos de envío de Mercado Libre API

export interface MLShippingMethod {
  shipping_method_id?: number; // Opcional para envíos internos
  option_id?: number; // ID de opción para obtener sucursales (ME2)
  option_hash?: string; // Hash de opción (ME2) para obtener sucursales
  state_id?: string; // ID de estado para endpoints geográficos (ej: AR-M)
  name: string;
  description: string;
  currency_id?: string; // Opcional para envíos internos
  list_cost?: number;
  cost: number;
  estimated_delivery?: {
    date: string;
    time_from: string;
    time_to: string;
  };
  shipping_mode?: string;
  speed?: {
    handling: number;
    shipping: number;
  };
  estimated_delivery_time?: {
    type: string;
    unit: string;
    value: number;
  };
  estimated_delivery_final?: {
    date: string;
    time_from: string;
    time_to: string;
  };
  logistic_type?: string;
  treatment?: string;
  guaranteed?: boolean;
  order_priority?: number;
  tags?: string[];
  // Campos adicionales para envíos a sucursal
  deliver_to?: 'address' | 'agency'; // Indica si es a domicilio o a sucursal
  carrier_id?: number; // ID del transportista para obtener sucursales
  // Campos adicionales para envíos internos
  id?: string; // Para envíos internos
  estimatedTime?: string; // Formato legible para humanos
  currency?: string; // ARS para envíos internos
  type?: 'me2' | 'internal'; // Tipo de envío
}

export interface MLShippingResponse {
  methods: MLShippingMethod[];
  coverage: {
    all_country: boolean;
    excluded_places: Array<{
      type: string;
      description: string;
    }>;
  };
}

// Internal domain model (simplified)
export interface ShippingMethod {
  order_priority: number;
  name: string;
  cost: number;
  estimated_delivery: {
    date: string;
    time_from: string;
    time_to: string;
  };
  shipping_mode: string;
}

export interface ShippingResponse {
  methods: ShippingMethod[];
  coverage: {
    all: boolean;
    partially_covered: boolean;
  };
}

// Type para método de envío seleccionado en checkout
export interface SelectedShippingMethod {
  id: string;
  name: string;
  description: string;
  currencyId: string;
  cost: number;
  estimated_delivery: {
    date: string;
    time_from: string;
    time_to: string;
  };
  shippingMode: string;
  logisticType: string;
}
