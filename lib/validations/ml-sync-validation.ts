import type { Product, Category } from '@/lib/schema';
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre';

// Interfaz para atributos de categoría de ML
interface MLAttribute {
  id: string;
  name: string;
  type: string;
  tags?: {
    required?: boolean;
    catalog_required?: boolean;
    allow_variations?: boolean;
    conditional_required?: boolean;
  };
  value_type?: string;
  values?: Array<{
    id?: string;
    name: string;
  }>;
  help_value?: string;
  allowed_units?: string[];
  max_length?: number;
  min_value?: number;
  max_value?: number;
}

// Interfaz para respuesta de la API de ML
interface MLApiResponse {
  id: string;
  name: string;
  type?: string;
  tags?: {
    required?: boolean;
    catalog_required?: boolean;
    allow_variations?: boolean;
    conditional_required?: boolean;
  };
  value_type?: string;
  values?: Array<{
    id?: string;
    name: string;
  }>;
  help_value?: string;
  allowed_units?: string[];
  max_length?: number;
  min_value?: number;
  max_value?: number;
}

// Interfaz para resultado de validación
export interface MLValidationResult {
  isValid: boolean;
  isReadyForSync: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: MLAttribute[];
  missingConditional: MLAttribute[];
  categoryAttributes: MLAttribute[];
}

// Cache para atributos de categorías (TTL: 5 minutos)
const categoryAttributesCache = new Map<string, { data: MLAttribute[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene los atributos requeridos de una categoría desde la API de ML
 */
export async function fetchCategoryAttributes(
  categoryId: string,
  userId?: number
): Promise<MLAttribute[]> {
  // Verificar cache
  const cached = categoryAttributesCache.get(categoryId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    let attributes: MLAttribute[] = [];
    
    if (userId && typeof window === 'undefined') {
      // Server-side: usar autenticación directa con ML
      try {
        const response = await makeAuthenticatedRequest(
          userId,
          `/categories/${categoryId}/attributes`,
          { method: 'GET' }
        );
        
        if (response.ok) {
          const data = await response.json();
          attributes = (data || []).map((attr: MLApiResponse) => ({
            id: attr.id,
            name: attr.name,
            type: attr.type || 'string',
            tags: attr.tags,
            value_type: attr.value_type,
            values: attr.values,
            help_value: attr.help_value,
            allowed_units: attr.allowed_units,
            max_length: attr.max_length,
            min_value: attr.min_value,
            max_value: attr.max_value
          }));
        }
      } catch (error) {
        console.warn(`Error obteniendo atributos directamente de ML para ${categoryId}:`, error);
      }
    }
    
    // Fallback a API local (client-side o si falló la directa)
    if (attributes.length === 0) {
      const baseUrl = typeof window !== 'undefined' 
        ? '' 
        : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      
      const url = userId 
        ? `${baseUrl}/api/mercadolibre/categories/${categoryId}/attributes?userId=${userId}`
        : `${baseUrl}/api/mercadolibre/categories/${categoryId}/attributes`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        attributes = (data.attributes || []).map((attr: {
          id: string;
          key: string;
          name: string;
          label: string;
          required?: boolean;
          value_type?: string;
          values?: Array<{ name: string }>;
        }) => ({
          id: attr.id || attr.key, // Usar key como fallback
          name: attr.name || attr.label, // Usar label como fallback
          type: 'string',
          tags: {
            required: attr.required,
            catalog_required: false,
            allow_variations: false,
            conditional_required: false
          },
          value_type: attr.value_type,
          values: attr.values,
          help_value: undefined,
          allowed_units: undefined,
          max_length: undefined,
          min_value: undefined,
          max_value: undefined
        }));
      }
    }

    // Guardar en cache
    if (attributes.length > 0) {
      categoryAttributesCache.set(categoryId, {
        data: attributes,
        timestamp: Date.now()
      });
    }

    return attributes;
  } catch (error) {
    console.error(`Error obteniendo atributos de categoría ${categoryId}:`, error);
    return [];
  }
}

/**
 * Verifica si un producto tiene todos los atributos requeridos de su categoría
 */
function hasRequiredAttributes(
  productAttributes: unknown,
  categoryAttributes: MLAttribute[]
): { hasAll: boolean; missing: MLAttribute[]; missingConditional: MLAttribute[] } {
  // Filtrar solo los atributos requeridos según la API de ML
  const requiredAttributes = categoryAttributes.filter(attr => 
    attr.tags?.required === true || attr.tags?.catalog_required === true
  );

  // Filtrar atributos condicionalmente requeridos
  const conditionalAttributes = categoryAttributes.filter(attr => 
    attr.tags?.conditional_required === true
  );

  if (!requiredAttributes || requiredAttributes.length === 0) {
    return { hasAll: true, missing: [], missingConditional: [] };
  }

  const missing: MLAttribute[] = [];
  const missingConditional: MLAttribute[] = [];
  
  // Normalizar atributos del producto
  const normalizedAttrs = new Map();
  if (productAttributes && Array.isArray(productAttributes)) {
    productAttributes.forEach((attr: {
      id?: string;
      name?: string;
      value_name?: string;
      values?: string[];
    }) => {
      // Validar que el atributo tenga la estructura esperada
      if (!attr || typeof attr !== 'object') {
        console.warn('[ML-Sync-Validation] Atributo inválido (no es objeto):', attr);
        return;
      }
      
      const key = attr.id || attr.name;
      
      // Manejar ambos formatos: value_name (ML) o values (nuestro formato)
      let value = attr.value_name;
      if (!value && attr.values && Array.isArray(attr.values) && attr.values.length > 0) {
        value = attr.values[0]; // Tomar el primer valor para validación
      }
      
      if (key && value) {
        try {
          if (typeof key === 'string') {
            normalizedAttrs.set(key.toLowerCase(), value);
          } else {
            console.warn('[ML-Sync-Validation] Key no es string:', { key, attr });
          }
        } catch (error) {
          console.error('[ML-Sync-Validation] Error procesando atributo:', { key, attr, error });
        }
      }
    });
  }

  // Verificar atributos requeridos usando los IDs de la API
  requiredAttributes.forEach((reqAttr) => {
    // Validar que reqAttr tenga id antes de procesar
    if (!reqAttr.id) {
      console.warn('[ML-Sync-Validation] Atributo requerido sin id:', reqAttr);
      return;
    }
    
    // Debug logging
    console.log('[ML-Sync-Validation] Verificando atributo requerido:', {
      required: reqAttr,
      hasId: normalizedAttrs.has(reqAttr.id.toLowerCase()),
      normalizedAttrs: Array.from(normalizedAttrs.entries())
    });
    
    const hasValue = normalizedAttrs.has(reqAttr.id.toLowerCase());
    
    if (!hasValue) {
      console.log('[ML-Sync-Validation] Atributo faltante:', reqAttr);
      missing.push(reqAttr);
    }
  });

  // Verificar atributos condicionalmente requeridos
  conditionalAttributes.forEach((condAttr) => {
    if (!condAttr.id) return;
    
    const hasValue = normalizedAttrs.has(condAttr.id.toLowerCase());
    
    if (!hasValue) {
      // Para atributos condicionales, verificar si hay un atributo "EMPTY_*" correspondiente
      const emptyReasonAttr = `EMPTY_${condAttr.id}_REASON`;
      const hasEmptyReason = normalizedAttrs.has(emptyReasonAttr.toLowerCase());
      
      if (!hasEmptyReason) {
        missingConditional.push(condAttr);
      }
    }
  });

  return { hasAll: missing.length === 0, missing, missingConditional };
}

/**
 * Validación completa para sincronización con Mercado Libre
 */
export async function validateProductForMLSync(
  product: Product,
  category?: Category | undefined,
  userId?: number
): Promise<MLValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let categoryAttributes: MLAttribute[] = [];
  const missing: MLAttribute[] = [];
  const missingConditional: MLAttribute[] = [];

  // 1. Validaciones básicas obligatorias
  if (!product.name || product.name.trim().length < 3) {
    errors.push('El título debe tener al menos 3 caracteres');
  }

  if (!product.price || Number(product.price) <= 0) {
    errors.push('El precio debe ser mayor a 0');
  }

  if (!product.stock || product.stock < 1) {
    errors.push('Debe haber al menos 1 unidad en stock');
  }

  if (!product.mlCategoryId) {
    errors.push('La categoría de Mercado Libre es requerida');
  }

  // 2. Validación de imágenes
  const images = product.images ? 
    (Array.isArray(product.images) ? product.images : [product.image]) : 
    [product.image].filter(Boolean);
  
  if (!images || images.length === 0) {
    errors.push('Se requiere al menos una imagen');
  }

  // 3. Validaciones ME2 (obligatorias)
  if (!product.weight || Number(product.weight) <= 0) {
    errors.push('El peso es obligatorio para Mercado Envíos');
  }
  
  if (!product.height || Number(product.height) <= 0) {
    errors.push('La altura es obligatoria para Mercado Envíos');
  }
  
  if (!product.width || Number(product.width) <= 0) {
    errors.push('El ancho es obligatorio para Mercado Envíos');
  }
  
  if (!product.length || Number(product.length) <= 0) {
    errors.push('El largo es obligatorio para Mercado Envíos');
  }

  // 4. Obtener y validar atributos de la categoría
  if (product.mlCategoryId) {
    categoryAttributes = await fetchCategoryAttributes(product.mlCategoryId, userId);
    
    const { hasAll, missing, missingConditional } = hasRequiredAttributes(
      product.attributes, 
      categoryAttributes
    );

    if (!hasAll) {
      errors.push(
        `Faltan atributos obligatorios de la categoría: ${missing.map(m => m.name).join(', ')}`
      );
    }

    // Agregar advertencias para atributos condicionalmente faltantes
    if (missingConditional.length > 0) {
      warnings.push(
        `Atributos condicionalmente requeridos faltantes: ${missingConditional.map(m => m.name).join(', ')}. Estos pueden ser necesarios para sincronización.`
      );
    }
  }

  // 5. Validaciones de advertencias
  if (product.description && product.description.length < 20) {
    warnings.push('Se recomienda una descripción más detallada');
  }

  if (images && images.length < 3) {
    warnings.push('Se recomienda agregar al menos 3 imágenes');
  }

  if (product.stock && product.stock > 100) {
    warnings.push('Stock mayor a 100 unidades puede requerir verificación');
  }

  const isValid = errors.length === 0;
  const isReadyForSync = isValid && categoryAttributes.length > 0;

  return {
    isValid,
    isReadyForSync,
    errors,
    warnings,
    missingRequired: missing,
    missingConditional,
    categoryAttributes
  };
}

/**
 * Valida múltiples productos para sincronización
 */
export async function validateMultipleProductsForML(
  products: Product[],
  userId?: number
): Promise<{ results: MLValidationResult[]; summary: { ready: number; notReady: number; errors: number } }> {
  const results = await Promise.all(
    products.map(product => validateProductForMLSync(product, undefined, userId))
  );

  const summary = {
    ready: results.filter(r => r.isReadyForSync).length,
    notReady: results.filter(r => !r.isValid).length,
    errors: results.filter(r => r.errors.length > 0).length
  };

  return { results, summary };
}

/**
 * Limpia el cache de atributos de categorías
 */
export function clearCategoryAttributesCache(): void {
  categoryAttributesCache.clear();
  console.log('[ML-Sync-Validation] Cache de atributos de categoría limpiado');
}

/**
 * Verifica si un producto está listo para sincronizar (versión simplificada)
 */
export async function isProductReadyForMLSync(
  product: Product,
  userId?: number
): Promise<boolean> {
  const validation = await validateProductForMLSync(product, undefined, userId);
  return validation.isReadyForSync;
}
