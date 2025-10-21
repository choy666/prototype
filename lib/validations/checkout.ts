import { z } from 'zod';

/**
 * Schema de validación para dirección de envío
 * Validaciones específicas para Argentina
 */
export const shippingAddressSchema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede tener más de 50 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios')
    .trim(),
  
  direccion: z
    .string()
    .min(5, 'La dirección debe tener al menos 5 caracteres')
    .max(100, 'La dirección no puede tener más de 100 caracteres')
    .trim(),
  
  ciudad: z
    .string()
    .min(2, 'La ciudad debe tener al menos 2 caracteres')
    .max(50, 'La ciudad no puede tener más de 50 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'La ciudad solo puede contener letras y espacios')
    .trim(),
  
  provincia: z
    .string()
    .min(2, 'La provincia debe tener al menos 2 caracteres')
    .max(50, 'La provincia no puede tener más de 50 caracteres')
    .trim(),
  
  codigoPostal: z
    .string()
    .regex(/^[A-Z]?\d{4}[A-Z]{0,3}$/, 'Código postal inválido (ej: 1234, C1234ABC)')
    .trim(),
  
  telefono: z
    .string()
    .regex(
      /^(?:(?:00)?549?)?0?(?:11|[2368]\d)(?:(?=\d{0,2}15)\d{2})??\d{8}$/,
      'Teléfono inválido (ej: 1123456789, 01123456789)'
    )
    .trim(),
});

/**
 * Schema para dirección guardada
 * Similar a shippingAddress pero sin validaciones de required
 */
export const addressSchema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede tener más de 50 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios')
    .trim(),

  direccion: z
    .string()
    .min(5, 'La dirección debe tener al menos 5 caracteres')
    .max(100, 'La dirección no puede tener más de 100 caracteres')
    .trim(),

  ciudad: z
    .string()
    .min(2, 'La ciudad debe tener al menos 2 caracteres')
    .max(50, 'La ciudad no puede tener más de 50 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'La ciudad solo puede contener letras y espacios')
    .trim(),

  provincia: z
    .string()
    .min(2, 'La provincia debe tener al menos 2 caracteres')
    .max(50, 'La provincia no puede tener más de 50 caracteres')
    .trim(),

  codigoPostal: z
    .string()
    .regex(/^[A-Z]?\d{4}[A-Z]{0,3}$/, 'Código postal inválido (ej: 1234, C1234ABC)')
    .trim(),

  telefono: z
    .string()
    .regex(
      /^(?:(?:00)?549?)?0?(?:11|[2368]\d)(?:(?=\d{0,2}15)\d{2})??\d{8}$/,
      'Teléfono inválido (ej: 1123456789, 01123456789)'
    )
    .trim(),

  isDefault: z.boolean().optional(),
});

/**
 * Schema para método de envío
 */
export const shippingMethodSchema = z.object({
  id: z.number(),
  name: z.string(),
});

/**
 * Schema para el checkout completo
 * Incluye items del carrito, dirección de envío y método de envío
 */
export const checkoutSchema = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      price: z.number(),
      quantity: z.number().min(1),
      image: z.string().optional(),
      discount: z.number().optional(),
      weight: z.number().optional(),
    })
  ).min(1, 'El carrito debe tener al menos un producto'),

  shippingAddress: shippingAddressSchema,

  shippingMethod: shippingMethodSchema,

  userId: z.string().optional(),
});

// Tipos TypeScript exportados
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
export type Address = z.infer<typeof addressSchema>;
export type CheckoutFormData = z.infer<typeof checkoutSchema>;
export type ShippingFormData = z.infer<typeof shippingAddressSchema>;
