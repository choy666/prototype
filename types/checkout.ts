export interface CheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  discount?: number;
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
  variantId?: string;
}

export interface ShippingAddress {
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  telefono: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  cost: number;
  estimated?: string;
  isFallback?: boolean;
  free_shipping?: boolean;
}

export interface CheckoutRequest {
  items: CheckoutItem[];
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  userId: string;
}

export interface CheckoutResult {
  paymentUrl: string;
  orderId: string;
  preferenceId: string;
}

export interface CartValidation {
  isValid: boolean;
  errors: string[];
}

export interface OrderSummary {
  subtotal: number;
  shippingCost: number;
  total: number;
  itemCount: number;
  discount: number;
}
