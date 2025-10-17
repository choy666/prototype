import { z } from 'zod';

export const cartItemSchema = z.object({
  id: z.number().int().positive('ID de producto debe ser un número positivo'),
  name: z.string().min(1, 'Nombre es requerido').max(255, 'Nombre demasiado largo'),
  price: z.number().min(0, 'Precio debe ser positivo').max(999999, 'Precio demasiado alto'),
  discount: z.number().min(0, 'Descuento debe ser positivo').max(100, 'Descuento no puede ser mayor a 100%'),
  quantity: z.number().int().min(1, 'Cantidad debe ser al menos 1').max(99, 'Cantidad máxima es 99'),
});

export const checkoutRequestSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'Debe haber al menos un item').max(50, 'Demasiados items'),
});

// Tipos
export type CartItem = z.infer<typeof cartItemSchema>;
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
