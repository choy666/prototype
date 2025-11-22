import { z } from 'zod';

// Esquema para validar la respuesta de la API de MercadoLibre
export const MercadoLibreApiResponseSchema = z.object({
  id: z.string().optional(),
  nickname: z.string().optional(),
  email: z.string().email().optional(),
  site_id: z.string().optional(),
  user_type: z.string().optional(),
  logo: z.string().optional(),
  points: z.number().optional(),
  site_status: z.string().optional(),
  permalink: z.string().optional(),
  seller_reputation: z.object({
    level_id: z.string().optional(),
    power_seller_status: z.string().optional(),
    transactions: z.object({
      period: z.string().optional(),
      total: z.number().optional(),
      completed: z.number().optional(),
      canceled: z.number().optional(),
      ratings: z.object({
        positive: z.number().optional(),
        negative: z.number().optional(),
        neutral: z.number().optional(),
      }).optional(),
    }).optional(),
  }).optional(),
});

// Esquema para validar tokens de acceso
export const MercadoLibreTokenSchema = z.object({
  access_token: z.string().min(1, 'El access token es requerido'),
  token_type: z.string().min(1, 'El token type es requerido'),
  expires_in: z.number().min(1, 'El tiempo de expiración es requerido'),
  scope: z.string().optional(),
  refresh_token: z.string().optional(),
  user_id: z.number().optional(),
});

// Esquema para validar el estado de conexión
export const MercadoLibreConnectionStatusSchema = z.object({
  connected: z.boolean(),
  userId: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().optional(),
});

// Esquema para validar solicitudes de conexión
export const MercadoLibreConnectRequestSchema = z.object({
  callbackUrl: z.string().url().optional(),
});

// Esquema para validar permisos solicitados
export const MercadoLibreScopesSchema = z.object({
  scopes: z.array(z.string()).min(1, 'Debe especificar al menos un scope'),
});

// Esquema para validar errores de la API
export const MercadoLibreErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  status: z.number().optional(),
});

// Esquema para validar parámetros de paginación
export const MercadoLibrePaginationSchema = z.object({
  limit: z.number().min(1).max(50).optional(),
  offset: z.number().min(0).optional(),
});

// Esquema para validar IDs de productos
export const MercadoLibreProductIdSchema = z.object({
  productId: z.string().min(1, 'El ID del producto es requerido'),
});

// Esquema para validar datos de productos
export const MercadoLibreProductSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(60, 'El título no puede exceder 60 caracteres'),
  category_id: z.string().min(1, 'El ID de categoría es requerido'),
  price: z.number().min(0.01, 'El precio debe ser mayor a 0'),
  currency_id: z.string().min(1, 'El ID de moneda es requerido'),
  available_quantity: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  buying_mode: z.enum(['buy_it_now', 'auction']),
  listing_type_id: z.string().min(1, 'El tipo de listado es requerido'),
  condition: z.enum(['new', 'used', 'not_specified']),
  description: z.string().optional(),
  pictures: z.array(z.object({
    source: z.string().url(),
  })).optional(),
});

// Tipos inferidos de los esquemas
export type MercadoLibreApiResponse = z.infer<typeof MercadoLibreApiResponseSchema>;
export type MercadoLibreToken = z.infer<typeof MercadoLibreTokenSchema>;
export type MercadoLibreConnectionStatus = z.infer<typeof MercadoLibreConnectionStatusSchema>;
export type MercadoLibreConnectRequest = z.infer<typeof MercadoLibreConnectRequestSchema>;
export type MercadoLibreScopes = z.infer<typeof MercadoLibreScopesSchema>;
export type MercadoLibreError = z.infer<typeof MercadoLibreErrorSchema>;
export type MercadoLibrePagination = z.infer<typeof MercadoLibrePaginationSchema>;
export type MercadoLibreProductId = z.infer<typeof MercadoLibreProductIdSchema>;
export type MercadoLibreProduct = z.infer<typeof MercadoLibreProductSchema>;

// Funciones de validación
export function validateMercadoLibreApiResponse(data: unknown): MercadoLibreApiResponse {
  return MercadoLibreApiResponseSchema.parse(data);
}

export function validateMercadoLibreToken(data: unknown): MercadoLibreToken {
  return MercadoLibreTokenSchema.parse(data);
}

export function validateMercadoLibreConnectionStatus(data: unknown): MercadoLibreConnectionStatus {
  return MercadoLibreConnectionStatusSchema.parse(data);
}

export function validateMercadoLibreConnectRequest(data: unknown): MercadoLibreConnectRequest {
  return MercadoLibreConnectRequestSchema.parse(data);
}

export function validateMercadoLibreScopes(data: unknown): MercadoLibreScopes {
  return MercadoLibreScopesSchema.parse(data);
}

export function validateMercadoLibreError(data: unknown): MercadoLibreError {
  return MercadoLibreErrorSchema.parse(data);
}

export function validateMercadoLibrePagination(data: unknown): MercadoLibrePagination {
  return MercadoLibrePaginationSchema.parse(data);
}

export function validateMercadoLibreProductId(data: unknown): MercadoLibreProductId {
  return MercadoLibreProductIdSchema.parse(data);
}

export function validateMercadoLibreProduct(data: unknown): MercadoLibreProduct {
  return MercadoLibreProductSchema.parse(data);
}
