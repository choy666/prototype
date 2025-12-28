import type { Product, Category } from '@/lib/schema';
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre';
import {
  getCategoryME2Rules,
  validateDimensionsWithRules,
  validateShippingAttributesWithRules,
} from '@/lib/mercado-envios/me2Rules';
import {
  evaluateCategoryAttributeRequirements,
  type AttributeRequirementResult,
  type InvalidAttributeEntry,
  type CategoryAttributeDefinition,
} from '@/lib/mercado-envios/attribute-requirements';

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
  invalidAttributes: InvalidAttributeEntry[];
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
            max_value: attr.max_value,
          }));
        }
      } catch (error) {
        console.warn(`Error obteniendo atributos directamente de ML para ${categoryId}:`, error);
      }
    }

    // Fallback a API local (client-side o si falló la directa)
    if (attributes.length === 0) {
      const baseUrl =
        typeof window !== 'undefined'
          ? ''
          : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

      const url = userId
        ? `${baseUrl}/api/mercadolibre/categories/${categoryId}/attributes?userId=${userId}`
        : `${baseUrl}/api/mercadolibre/categories/${categoryId}/attributes`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        attributes = (data.attributes || []).map(
          (attr: {
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
              conditional_required: false,
            },
            value_type: attr.value_type,
            values: attr.values,
            help_value: undefined,
            allowed_units: undefined,
            max_length: undefined,
            min_value: undefined,
            max_value: undefined,
          })
        );
      }
    }

    // Guardar en cache
    if (attributes.length > 0) {
      categoryAttributesCache.set(categoryId, {
        data: attributes,
        timestamp: Date.now(),
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
): AttributeRequirementResult & { hasAll: boolean } {
  const evaluation = evaluateCategoryAttributeRequirements(
    productAttributes,
    categoryAttributes as unknown as CategoryAttributeDefinition[]
  );

  return {
    hasAll: evaluation.missingRequired.length === 0 && evaluation.invalidValues.length === 0,
    ...evaluation,
  };
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
  let invalidAttributes: InvalidAttributeEntry[] = [];

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
  const images = product.images
    ? Array.isArray(product.images)
      ? product.images
      : [product.image]
    : [product.image].filter(Boolean);

  if (!images || images.length === 0) {
    errors.push('Se requiere al menos una imagen');
  }

  // 3. Validaciones ME2 con reglas por categoría
  const me2Rules = await getCategoryME2Rules(product.mlCategoryId);
  const dimensionValidation = validateDimensionsWithRules(
    {
      height: Number(product.height) || 0,
      width: Number(product.width) || 0,
      length: Number(product.length) || 0,
      weight: Number(product.weight) || 0,
    },
    me2Rules
  );

  if (!dimensionValidation.isValid) {
    errors.push(`Dimensiones/peso inválidos para ME2: ${dimensionValidation.missing.join(', ')}`);
  }
  warnings.push(...dimensionValidation.warnings);

  const shippingValidation = validateShippingAttributesWithRules(
    (product as unknown as { shippingAttributes?: Record<string, unknown> }).shippingAttributes,
    me2Rules
  );

  if (!shippingValidation.isValid) {
    errors.push(`Atributos de envío incompletos: ${shippingValidation.missing.join(', ')}`);
  }
  warnings.push(...shippingValidation.warnings);

  // 4. Obtener y validar atributos de la categoría
  if (product.mlCategoryId) {
    categoryAttributes = await fetchCategoryAttributes(product.mlCategoryId, userId);

    const requirementResult = hasRequiredAttributes(product.attributes, categoryAttributes);
    const mapToMLAttribute = (attr: CategoryAttributeDefinition): MLAttribute => ({
      id: attr.id,
      name: attr.name ?? attr.id,
      type: attr.type ?? 'string',
      tags: attr.tags as MLAttribute['tags'],
      value_type: attr.value_type,
      values: attr.values?.map((value) => ({
        id: value.id,
        name: value.name,
      })),
      help_value: attr.help_value,
      allowed_units: attr.allowed_units,
      max_length: attr.max_length,
      min_value: attr.min_value,
      max_value: attr.max_value,
    });

    missing.push(...requirementResult.missingRequired.map(mapToMLAttribute));
    missingConditional.push(...requirementResult.missingConditional.map(mapToMLAttribute));
    invalidAttributes = requirementResult.invalidValues;

    if (!requirementResult.hasAll) {
      if (requirementResult.missingRequired.length > 0) {
        errors.push(
          `Faltan atributos obligatorios de la categoría: ${requirementResult.missingRequired
            .map((m) => m.name || m.id)
            .join(', ')}`
        );
      }

      if (requirementResult.invalidValues.length > 0) {
        requirementResult.invalidValues.forEach((invalidAttr) => {
          errors.push(
            `El atributo "${invalidAttr.attribute.name ?? invalidAttr.attribute.id}" tiene un valor inválido (${invalidAttr.providedValue}).`
          );
        });
      }
    }

    if (requirementResult.missingConditional.length > 0) {
      const conditionalList = requirementResult.missingConditional
        .map((m) => m.name || m.id)
        .join(', ');

      errors.push(
        `Faltan atributos condicionales: ${conditionalList}. Completa los valores o marca la opción "No aplica" usando EMPTY_*_REASON.`
      );

      warnings.push(
        `Atributos condicionalmente requeridos faltantes: ${conditionalList}. Puedes justificar con EMPTY_*_REASON si no aplican.`
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
    categoryAttributes,
    invalidAttributes,
  };
}

/**
 * Valida múltiples productos para sincronización
 */
export async function validateMultipleProductsForML(
  products: Product[],
  userId?: number
): Promise<{
  results: MLValidationResult[];
  summary: { ready: number; notReady: number; errors: number };
}> {
  const results = await Promise.all(
    products.map((product) => validateProductForMLSync(product, undefined, userId))
  );

  const summary = {
    ready: results.filter((r) => r.isReadyForSync).length,
    notReady: results.filter((r) => !r.isValid).length,
    errors: results.filter((r) => r.errors.length > 0).length,
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
export async function isProductReadyForMLSync(product: Product, userId?: number): Promise<boolean> {
  const validation = await validateProductForMLSync(product, undefined, userId);
  return validation.isReadyForSync;
}
