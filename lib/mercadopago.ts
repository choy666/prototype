// En lib/mercadopago.ts
import { MercadoPagoConfig, Preference } from 'mercadopago';

if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
  throw new Error('Falta la variable de entorno MERCADOPAGO_ACCESS_TOKEN');
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
  options: { timeout: 5000 },
});

export const mercadoPago = {
  preferences: new Preference(client),
  // Otros recursos de Mercado Pago
};

// Tipos para las preferencias de pago
export interface CreatePreferencePayload {
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    description?: string;
    picture_url?: string;
  }>;
  back_urls: {
    success: string;
    failure: string;
    pending: string;
  };
  auto_return?: 'approved';
  external_reference?: string;
  notification_url?: string;
}