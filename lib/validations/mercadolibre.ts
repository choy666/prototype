import { z } from 'zod';
import type { Product } from '@/lib/schema';

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

// Esquema para validar datos de productos (mejorado)
export const MercadoLibreProductSchema = z.object({
  title: z
    .string()
    .min(1, 'El título es requerido')
    .max(60, 'El título no puede exceder 60 caracteres'),
  category_id: z
    .string()
    .min(1, 'La categoría de ML es requerida')
    .regex(/^MLA\d+$/, 'El ID de categoría debe tener formato MLA123'),
  price: z
    .number()
    .min(1, 'El precio debe ser mayor a 0')
    .max(1000000, 'El precio no puede exceder $1.000.000'),
  currency_id: z
    .string()
    .min(1, 'La moneda es requerida')
    .default('ARS'),
  available_quantity: z
    .number()
    .int('La cantidad debe ser un entero')
    .min(1, 'Debe haber al menos 1 unidad disponible')
    .max(999999, 'La cantidad no puede exceder 999.999'),
  buying_mode: z
    .enum(['buy_it_now', 'auction'])
    .default('buy_it_now'),
  listing_type_id: z
    .enum(['free', 'gold_special'])
    .default('free'),
  condition: z
    .enum(['new', 'used'])
    .default('new'),
  description: z
    .string()
    .max(50000, 'La descripción no puede exceder 50.000 caracteres')
    .optional()
    .default(''),
  pictures: z
    .array(
      z.object({
        source: z
          .string()
          .url('La URL de la imagen debe ser válida')
          .regex(/\.(jpg|jpeg|png|gif|webp)$/i, 'La imagen debe ser JPG, PNG, GIF o WEBP')
      })
    )
    .min(1, 'Se requiere al menos 1 imagen')
    .max(12, 'No se pueden subir más de 12 imágenes'),
  video_id: z.string().optional(),
  attributes: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1, 'El nombre del atributo es requerido'),
        value_name: z.string().min(1, 'El valor del atributo es requerido'),
      })
    )
    .optional()
    .default([]),
  warranty: z
    .string()
    .max(60, 'La garantía no puede exceder 60 caracteres')
    .optional(),
  tags: z
    .array(z.string())
    .max(10, 'No se pueden agregar más de 10 tags')
    .optional()
    .default([]),
});

// Categorías válidas para Argentina
export const VALID_CATEGORIES = {
  'MLA3530': 'Electrónica, Audio y Video',
  'MLA1648': 'Computación',
  'MLA1051': 'Celulares y Teléfonos',
  'MLA1430': 'Ropa y Accesorios',
  'MLA1144': 'Calzado',
  'MLA1384': 'Belleza y Cuidado Personal',
  'MLA3025': 'Libros, Revistas y Comics',
  'MLA1168': 'Deportes y Fitness',
  'MLA1574': 'Hogar, Muebles y Jardín',
  'MLA1558': 'Juegos y Juguetes',
  'MLA1953': 'Consolas y Videojuegos',
  'MLA2541': 'Instrumentos Musicales',
  'MLA1492': 'Animales y Mascotas',
  'MLA1071': 'Antigüedades y Colecciones',
  'MLA1182': 'Arte y Artesanías',
  'MLA3937': 'Agro',
  'MLA1512': 'Autos, Motos y Otros',
  'MLA1276': 'Bebés',
  'MLA1039': 'Bolsos, Carteras y Mochilas',
  'MLA1743': 'Cámaras y Accesorios',
  'MLA1000': 'Accesorios para Vehículos',
  'MLA1132': 'Bienes Raíces',
  'MLA1459': 'Industrias y Oficinas',
  'MLA1188': 'Ingresos y Empleos',
  'MLA2568': 'Joyas y Relojes',
  'MLA3697': 'Salud y Equipamiento Médico',
  'MLA1367': 'Música, Películas y Series',
  'MLA1368': 'Otros',
  'MLA2521': 'Servicios',
  'MLA1540': 'Souvenirs, Cotillón y Fiestas',
  'MLA2820': 'Tecnología',
  'MLA1112': 'Tickets y Entradas',
  'MLA1692': 'Turismo',
};

// Precios mínimos por categoría (actualizable según requerimientos de ML)
export const CATEGORY_MIN_PRICES: Record<string, number> = {
  'MLA3530': 1000, // Electrónica, Audio y Video
  'MLA1648': 500,  // Computación
  'MLA1051': 800,  // Celulares y Teléfonos
  'MLA1430': 100,  // Ropa y Accesorios
  'MLA1144': 150,  // Calzado
  'MLA1384': 200,  // Belleza y Cuidado Personal
  'MLA3025': 50,   // Libros, Revistas y Comics
  'MLA1168': 300,  // Deportes y Fitness
  'MLA1574': 200,  // Hogar, Muebles y Jardín
  'MLA1558': 150,  // Juegos y Juguetes
  'MLA1953': 500,  // Consolas y Videojuegos
  'MLA2541': 400,  // Instrumentos Musicales
  'MLA1492': 250,  // Animales y Mascotas
  'MLA1071': 1000, // Antigüedades y Colecciones
  'MLA1182': 100,  // Arte y Artesanías
  'MLA3937': 2000, // Agro
  'MLA1512': 5000, // Autos, Motos y Otros
  'MLA1276': 150,  // Bebés
  'MLA1039': 200,  // Bolsos, Carteras y Mochilas
  'MLA1743': 300,  // Cámaras y Accesorios
  'MLA1000': 150,  // Accesorios para Vehículos
  'MLA1132': 10000, // Bienes Raíces
  'MLA1459': 500,  // Industrias y Oficinas
  'MLA1188': 100,  // Ingresos y Empleos
  'MLA2568': 800,  // Joyas y Relojes
  'MLA3697': 1500, // Salud y Equipamiento Médico
  'MLA1367': 50,   // Música, Películas y Series
  'MLA1368': 100,  // Otros
  'MLA2521': 200,  // Servicios
  'MLA1540': 80,   // Souvenirs, Cotillón y Fiestas
  'MLA2820': 600,  // Tecnología
  'MLA1112': 30,   // Tickets y Entradas
  'MLA1692': 500,  // Turismo
};

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

// Funciones de validación básicas
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

// ======================
// Validaciones extendidas para productos
// ======================

// Validar imágenes
export function validateImages(images: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!images || images.length === 0) {
    errors.push('Se requiere al menos una imagen');
    return { valid: false, errors };
  }

  if (images.length > 12) {
    errors.push('No se pueden subir más de 12 imágenes');
  }

  images.forEach((imageUrl, index) => {
    if (!imageUrl || typeof imageUrl !== 'string') {
      errors.push(`La imagen ${index + 1} no es válida`);
      return;
    }

    // Validar formato de URL
    try {
      new URL(imageUrl);
    } catch {
      errors.push(`La imagen ${index + 1} no tiene una URL válida`);
      return;
    }

    // Validar extensión
    const validExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (!validExtensions.test(imageUrl)) {
      errors.push(`La imagen ${index + 1} debe ser JPG, PNG, GIF o WEBP`);
    }

    // Validar que sea una URL accesible (básico)
    if (!imageUrl.startsWith('http')) {
      errors.push(`La imagen ${index + 1} debe ser una URL completa (http/https)`);
    }
  });

  return { valid: errors.length === 0, errors };
}

// Validar accesibilidad de imágenes (modo advertencia no bloqueante)
export async function validateImageAccessibility(images: string[]): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!images || images.length === 0) {
    errors.push('Se requiere al menos una imagen');
    return { valid: false, errors, warnings };
  }

  if (images.length > 12) {
    errors.push('No se pueden subir más de 12 imágenes');
  }

  // Validaciones básicas de formato y URL
  images.forEach((imageUrl, index) => {
    if (!imageUrl || typeof imageUrl !== 'string') {
      errors.push(`La imagen ${index + 1} no es válida`);
      return;
    }

    try {
      new URL(imageUrl);
    } catch {
      errors.push(`La imagen ${index + 1} no tiene una URL válida`);
      return;
    }

    const validExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (!validExtensions.test(imageUrl)) {
      errors.push(`La imagen ${index + 1} debe ser JPG, PNG, GIF o WEBP`);
    }

    if (!imageUrl.startsWith('http')) {
      errors.push(`La imagen ${index + 1} debe ser una URL completa (http/https)`);
    }
  });

  // Verificación de accesibilidad (paralela, no bloqueante)
  if (errors.length === 0) {
    const accessibilityChecks = images.map(async (imageUrl, index) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos timeout

        const response = await fetch(imageUrl, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return `La imagen ${index + 1} no es accesible (HTTP ${response.status})`;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
          return `La imagen ${index + 1} no parece ser un archivo de imagen válido`;
        }

        return null;
      } catch {
        return `La imagen ${index + 1} no se pudo verificar (timeout o error de red)`;
      }
    });

    const results = await Promise.allSettled(accessibilityChecks);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        warnings.push(result.value);
      } else if (result.status === 'rejected') {
        warnings.push(`La imagen ${index + 1} no se pudo verificar (error inesperado)`);
      }
    });
  }

  return { 
    valid: errors.length === 0, 
    errors, 
    warnings 
  };
}

// Sanitizar HTML en títulos
export function sanitizeTitle(title: string): string {
  if (!title || typeof title !== 'string') {
    return '';
  }
  
  // Eliminar todos los tags HTML
  let sanitized = title.replace(/<[^>]*>/g, '');
  
  // Eliminar entidades HTML comunes
  sanitized = sanitized.replace(/&nbsp;/g, ' ')
                       .replace(/&amp;/g, '&')
                       .replace(/&lt;/g, '<')
                       .replace(/&gt;/g, '>')
                       .replace(/&quot;/g, '"')
                       .replace(/&#39;/g, "'")
                       .replace(/&apos;/g, "'");
  
  // Normalizar espacios múltiples
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

// Validar título
export function validateTitle(title: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!title || typeof title !== 'string') {
    errors.push('El título es requerido');
    return { valid: false, errors };
  }

  // Sanitizar HTML primero
  const sanitizedTitle = sanitizeTitle(title);

  if (sanitizedTitle.trim().length === 0) {
    errors.push('El título no puede estar vacío');
  }

  if (sanitizedTitle.length > 60) {
    errors.push('El título no puede exceder 60 caracteres');
  }

  if (sanitizedTitle.length < 3) {
    errors.push('El título debe tener al menos 3 caracteres');
  }

  // Validar caracteres no permitidos (después de sanitización)
  const invalidChars = /[<>]/;
  if (invalidChars.test(sanitizedTitle)) {
    errors.push('El título contiene caracteres no permitidos');
  }

  return { valid: errors.length === 0, errors };
}

// Validar precio
export function validatePrice(price: string | number, categoryId?: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  if (isNaN(numPrice)) {
    errors.push('El precio debe ser un número válido');
    return { valid: false, errors };
  }

  if (numPrice <= 0) {
    errors.push('El precio debe ser mayor a 0');
  }

  if (numPrice > 1000000) {
    errors.push('El precio no puede exceder $1.000.000');
  }

  // Validar precio mínimo por categoría
  if (categoryId && CATEGORY_MIN_PRICES[categoryId]) {
    const minPrice = CATEGORY_MIN_PRICES[categoryId];
    if (numPrice < minPrice) {
      errors.push(`La categoría ${categoryId} requiere un precio mínimo de $${minPrice}`);
    }
  }

  // Validar decimales (máximo 2)
  const decimalPart = numPrice.toString().split('.')[1];
  if (decimalPart && decimalPart.length > 2) {
    errors.push('El precio no puede tener más de 2 decimales');
  }

  return { valid: errors.length === 0, errors };
}

// Validar stock
export function validateStock(stock: string | number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const numStock = typeof stock === 'string' ? parseInt(stock) : stock;

  if (isNaN(numStock)) {
    errors.push('El stock debe ser un número válido');
    return { valid: false, errors };
  }

  if (numStock < 1) {
    errors.push('Debe haber al menos 1 unidad disponible para publicar');
  }

  if (numStock > 999999) {
    errors.push('El stock no puede exceder 999.999 unidades');
  }

  if (!Number.isInteger(numStock)) {
    errors.push('El stock debe ser un número entero');
  }

  return { valid: errors.length === 0, errors };
}

// Validar categoría
export function validateCategory(categoryId: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!categoryId || typeof categoryId !== 'string') {
    errors.push('La categoría de ML es requerida');
    return { valid: false, errors };
  }

  if (!VALID_CATEGORIES[categoryId as keyof typeof VALID_CATEGORIES]) {
    errors.push(`La categoría "${categoryId}" no es válida para Argentina`);
  }

  return { valid: errors.length === 0, errors };
}

// Validar descripción
export function validateDescription(description: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (description && description.length > 50000) {
    errors.push('La descripción no puede exceder 50.000 caracteres');
  }

  // Validar HTML potencialmente peligroso
  const dangerousTags = /<script|<iframe|<object|<embed/i;
  if (dangerousTags.test(description)) {
    errors.push('La descripción contiene HTML no permitido');
  }

  return { valid: errors.length === 0, errors };
}

// Validación completa de producto para ML
export function validateProductForMercadoLibre(product: Product): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validar título
  const titleValidation = validateTitle(product.name || '');
  if (!titleValidation.valid) {
    errors.push(...titleValidation.errors);
  }

  // Validar precio
  const priceValidation = validatePrice(product.price || '0', product.mlCategoryId || undefined);
  if (!priceValidation.valid) {
    errors.push(...priceValidation.errors);
  }

  // Validar stock
  const stockValidation = validateStock(product.stock || 0);
  if (!stockValidation.valid) {
    errors.push(...stockValidation.errors);
  }

  // Validar categoría ML
  if (!product.mlCategoryId) {
    errors.push('La categoría de Mercado Libre es requerida');
  } else {
    const categoryValidation = validateCategory(product.mlCategoryId);
    if (!categoryValidation.valid) {
      errors.push(...categoryValidation.errors);
    }
  }

  // Validar imágenes
  const images = product.images ? 
    (Array.isArray(product.images) ? product.images : [product.image]) : 
    [product.image].filter(Boolean);
  
  const imageValidation = validateImages(images);
  if (!imageValidation.valid) {
    errors.push(...imageValidation.errors);
  }

  // Validar descripción
  const descriptionValidation = validateDescription(product.description || '');
  if (!descriptionValidation.valid) {
    errors.push(...descriptionValidation.errors);
  }

  // Validaciones ME2 (obligatorias según error de ML)
  if (!product.weight || Number(product.weight) <= 0) {
    errors.push('El peso es obligatorio para Mercado Envíos 2 (ME2)');
  }
  
  if (!product.height || Number(product.height) <= 0) {
    errors.push('La altura es obligatoria para Mercado Envíos 2 (ME2)');
  }
  
  if (!product.width || Number(product.width) <= 0) {
    errors.push('El ancho es obligatorio para Mercado Envíos 2 (ME2)');
  }
  
  if (!product.length || Number(product.length) <= 0) {
    errors.push('El largo es obligatorio para Mercado Envíos 2 (ME2)');
  }

  // Validar que el modo de envío sea compatible con ME2
  if (product.shippingMode && product.shippingMode !== 'me2') {
    warnings.push(`El modo de envío configurado es "${product.shippingMode}" pero ME2 es obligatorio`);
  }

  // Validaciones adicionales (warnings)
  if (product.stock && product.stock > 100) {
    warnings.push('Stock mayor a 100 unidades puede requerir verificación adicional');
  }

  if (product.price && Number(product.price) > 100000) {
    warnings.push('Productos de alto valor pueden requerir verificación adicional');
  }

  if (!product.description || product.description.length < 20) {
    warnings.push('Se recomienda una descripción más detallada para mejor visibilidad');
  }

  if (images.length < 3) {
    warnings.push('Se recomienda agregar al menos 3 imágenes para mejor conversión');
  }

  // Validar tipo de publicación
  if (product.mlListingTypeId && !['free', 'gold_special'].includes(product.mlListingTypeId)) {
    errors.push(`El tipo de publicación "${product.mlListingTypeId}" no es válido`);
  }

  // Validar condición
  if (product.mlCondition && !['new', 'used'].includes(product.mlCondition)) {
    errors.push(`La condición "${product.mlCondition}" no es válida`);
  }

  // Validar modo de compra
  if (product.mlBuyingMode && !['buy_it_now', 'auction'].includes(product.mlBuyingMode)) {
    errors.push(`El modo de compra "${product.mlBuyingMode}" no es válido`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Obtener categoría ML por nombre
export function getMercadoLibreCategoryByName(categoryName: string): string | null {
  const normalizedCategory = categoryName.toLowerCase();
  
  for (const [categoryId, categoryDescription] of Object.entries(VALID_CATEGORIES)) {
    if (categoryDescription.toLowerCase().includes(normalizedCategory)) {
      return categoryId;
    }
  }
  
  return null;
}

// Sugerir categoría basada en el nombre del producto
export function suggestCategoryForProduct(productName: string): string | null {
  const name = productName.toLowerCase();
  
  // Palabras clave por categoría
  const keywordsByCategory: Record<string, string[]> = {
    'MLA3530': ['celular', 'smartphone', 'teléfono', 'phone', 'móvil'],
    'MLA1648': ['computadora', 'laptop', 'notebook', 'pc', 'computador'],
    'MLA1051': ['audífonos', 'cargador', 'case', 'protector', 'cable'],
    'MLA1430': ['camisa', 'pantalón', 'vestido', 'ropa', 'prenda'],
    'MLA1144': ['zapatilla', 'zapato', 'bota', 'calzado'],
    'MLA1384': ['crema', 'perfume', 'maquillaje', 'cosmético'],
    'MLA3025': ['libro', 'revista', 'comic'],
    'MLA1168': ['pelota', 'bicicleta', 'deporte', 'gimnasio'],
    'MLA1574': ['silla', 'mesa', 'cama', 'sofá', 'decoración'],
    'MLA1558': ['juguete', 'juego', 'niño'],
    'MLA1953': ['playstation', 'xbox', 'nintendo', 'videojuego'],
  };
  
  for (const [categoryId, keywords] of Object.entries(keywordsByCategory)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      return categoryId;
    }
  }
  
  return null;
}
