// Interfaces para métodos de envío de Mercado Libre API

export interface MLShippingMethod {
  shipping_method_id: number;
  name: string;
  description: string;
  currency_id: string;
  list_cost: number;
  cost: number;
  estimated_delivery: {
    date: string;
    time_from: string;
    time_to: string;
  };
  shipping_mode: string;
  speed: {
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
