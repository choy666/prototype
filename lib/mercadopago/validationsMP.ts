// lib/validationsMP.ts
import { z } from 'zod'

export const ShippingFormSchema = z.object({
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  email: z.string().email('Email inválido'),
  address: z.string().min(1, 'Dirección requerida'),
  city: z.string().min(1, 'Ciudad requerida'),
  postalCode: z.string().min(1, 'Código postal requerido'),
  country: z.string().min(1, 'País requerido'),
})

export type ShippingFormValidated = z.infer<typeof ShippingFormSchema>