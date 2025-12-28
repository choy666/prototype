import { getME2Config } from '@/lib/config/integrations';
import { db } from '@/lib/db';
import { categories } from '@/lib/schema';
import { logger } from '@/lib/utils/logger';
import { eq } from 'drizzle-orm';

type DimensionKey = 'height' | 'width' | 'length' | 'weight';

export interface DimensionSet {
  height: number;
  width: number;
  length: number;
  weight: number;
}

export interface ME2CategoryRules {
  minDimensions: Record<DimensionKey, number>;
  maxDimensions: Record<DimensionKey, number>;
  requiredShippingAttributes: string[];
  optionalShippingAttributes: string[];
  attributeCombinationLimit: number;
  allowDuplicateCombinations: boolean;
}

export interface DimensionValidationResult {
  isValid: boolean;
  missing: DimensionKey[];
  warnings: string[];
}

export interface ShippingValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

export interface MLAttributeDefinition {
  id: string;
  name: string;
  tags?: Record<string, unknown>;
  values?: Array<{ id?: string; name: string }>;
  value_type?: string;
}

export interface NormalizedAttributeCombination {
  id: string;
  name: string;
  value_name: string;
  value_id?: string;
}

export interface AttributeCombinationResult {
  combinations: NormalizedAttributeCombination[];
  errors: string[];
  warnings: string[];
}

interface MercadoLibreAttributeValue {
  id?: string;
  name?: string;
}

interface MercadoLibreAttributeResponse {
  id: string;
  name?: string;
  tags?: Record<string, unknown>;
  values?: MercadoLibreAttributeValue[];
}

const me2Config = getME2Config();

const DEFAULT_RULES: ME2CategoryRules = {
  minDimensions: {
    height: me2Config.minDimensions.height,
    width: me2Config.minDimensions.width,
    length: me2Config.minDimensions.length,
    weight: me2Config.minDimensions.weight,
  },
  maxDimensions: {
    height: me2Config.maxDimensions.height,
    width: me2Config.maxDimensions.width,
    length: me2Config.maxDimensions.length,
    weight: me2Config.maxDimensions.weight,
  },
  requiredShippingAttributes: ['mode', 'local_pick_up', 'free_shipping'],
  optionalShippingAttributes: ['handling_time', 'logistic_type', 'dimensions'],
  attributeCombinationLimit: 60,
  allowDuplicateCombinations: false,
};

function mergeRules(base: ME2CategoryRules, overrides?: Partial<ME2CategoryRules>): ME2CategoryRules {
  if (!overrides) {
    return base;
  }

  return {
    minDimensions: {
      ...base.minDimensions,
      ...(overrides.minDimensions ?? {}),
    },
    maxDimensions: {
      ...base.maxDimensions,
      ...(overrides.maxDimensions ?? {}),
    },
    requiredShippingAttributes: overrides.requiredShippingAttributes ?? base.requiredShippingAttributes,
    optionalShippingAttributes: overrides.optionalShippingAttributes ?? base.optionalShippingAttributes,
    attributeCombinationLimit: overrides.attributeCombinationLimit ?? base.attributeCombinationLimit,
    allowDuplicateCombinations: overrides.allowDuplicateCombinations ?? base.allowDuplicateCombinations,
  };
}

export async function getCategoryME2Rules(mlCategoryId?: string | null): Promise<ME2CategoryRules> {
  if (!mlCategoryId) {
    return DEFAULT_RULES;
  }

  try {
    const category = await db.query.categories.findFirst({
      where: eq(categories.mlCategoryId, mlCategoryId),
      columns: {
        attributes: true,
        name: true,
      },
    });

    if (!category || !category.attributes || typeof category.attributes !== 'object') {
      return DEFAULT_RULES;
    }

    const attributesPayload = category.attributes as Record<string, unknown>;
    // Permitir guardar reglas bajo llave me2Rules en el JSON de la categoría
    if ('me2Rules' in attributesPayload && typeof attributesPayload.me2Rules === 'object' && attributesPayload.me2Rules !== null) {
      const overrides = attributesPayload.me2Rules as Partial<ME2CategoryRules>;
      return mergeRules(DEFAULT_RULES, overrides);
    }

    return DEFAULT_RULES;
  } catch (error) {
    logger.error('[ME2 Rules] Error obteniendo reglas por categoría', {
      mlCategoryId,
      error: error instanceof Error ? error.message : String(error),
    });
    return DEFAULT_RULES;
  }
}

export function validateDimensionsWithRules(dimensions: DimensionSet, rules: ME2CategoryRules): DimensionValidationResult {
  const missing: DimensionKey[] = [];
  const warnings: string[] = [];

  (Object.keys(dimensions) as DimensionKey[]).forEach((key) => {
    const value = Number(dimensions[key]) || 0;
    if (value <= 0) {
      missing.push(key);
      warnings.push(`⚠️ ${key} no configurado (requerido para ME2)`);
      return;
    }

    const minValue = rules.minDimensions[key];
    const maxValue = rules.maxDimensions[key];

    if (value < minValue) {
      missing.push(key);
      warnings.push(`⚠️ ${key} debe ser ≥ ${minValue}`);
    }

    if (value > maxValue) {
      warnings.push(`⚠️ ${key} excede el máximo permitido (${maxValue})`);
    }
  });

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

export function validateShippingAttributesWithRules(
  shippingAttributes: Record<string, unknown> | null | undefined,
  rules: ME2CategoryRules
): ShippingValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!shippingAttributes) {
    warnings.push('⚠️ Atributos de envío no configurados');
    missing.push(...rules.requiredShippingAttributes);
    return {
      isValid: false,
      missing,
      warnings,
    };
  }

  rules.requiredShippingAttributes.forEach((attributeKey) => {
    if (!(attributeKey in shippingAttributes)) {
      missing.push(attributeKey);
      warnings.push(`⚠️ Falta el atributo de envío "${attributeKey}"`);
    }
  });

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeVariantAttributeCombinations(
  additionalAttributes: Record<string, string> | undefined | null,
  mlAttributes: MLAttributeDefinition[] = [],
  rules: ME2CategoryRules = DEFAULT_RULES
): AttributeCombinationResult {
  if (!additionalAttributes || Object.keys(additionalAttributes).length === 0) {
    return { combinations: [], errors: [], warnings: [] };
  }

  const combinations: NormalizedAttributeCombination[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const usedAttributeIds = new Set<string>();

  const attributeIndex = mlAttributes.reduce<Record<string, MLAttributeDefinition>>((acc, attr) => {
    acc[normalizeKey(attr.id)] = attr;
    acc[normalizeKey(attr.name)] = attr;
    return acc;
  }, {});

  for (const [rawKey, rawValue] of Object.entries(additionalAttributes)) {
    const valueName = rawValue?.trim();
    if (!valueName) continue;

    const lookupKey = normalizeKey(rawKey);
    const attrDefinition = attributeIndex[lookupKey];

    const attributeId = attrDefinition?.id ?? rawKey;
    if (usedAttributeIds.has(attributeId) && !rules.allowDuplicateCombinations) {
      errors.push(`La combinación para "${attributeId}" está duplicada.`);
      continue;
    }

    usedAttributeIds.add(attributeId);

    const combination: NormalizedAttributeCombination = {
      id: attributeId,
      name: attrDefinition?.name ?? rawKey,
      value_name: valueName,
    };

    if (attrDefinition?.values && attrDefinition.values.length > 0) {
      const matchedValue = attrDefinition.values.find(
        (entry) => normalizeKey(entry.name) === normalizeKey(valueName)
      );

      if (matchedValue?.id) {
        combination.value_id = matchedValue.id;
      } else {
        warnings.push(`Valor "${valueName}" no encontrado en catálogo para "${combination.name}". Se enviará como texto.`);
      }
    }

    combinations.push(combination);
  }

  if (combinations.length > rules.attributeCombinationLimit) {
    errors.push(
      `La variante excede el límite de combinaciones permitido (${rules.attributeCombinationLimit}).`
    );
  }

  return {
    combinations,
    errors,
    warnings,
  };
}

export async function fetchMLAttributeDefinitions(
  mlCategoryId?: string | null
): Promise<MLAttributeDefinition[]> {
  if (!mlCategoryId) {
    return [];
  }

  try {
    const response = await fetch(
      `https://api.mercadolibre.com/categories/${mlCategoryId}/attributes`
    );

    if (!response.ok) {
      logger.warn('[ML Attributes] No se pudieron obtener atributos oficiales', {
        mlCategoryId,
        status: response.status,
      });
      return [];
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      return [];
    }

    return (data as MercadoLibreAttributeResponse[])
      .filter((attr) => Boolean(attr?.id))
      .map<MLAttributeDefinition>((attr) => ({
        id: attr.id,
        name: attr.name ?? attr.id,
        tags: attr.tags,
        values: Array.isArray(attr.values)
          ? attr.values
              .filter((value) => value && (value.id || value.name))
              .map((value) => ({
                id: value.id,
                name: value.name ?? String(value.id ?? ''),
              }))
          : undefined,
      }));
  } catch (error) {
    logger.error('[ML Attributes] Error obteniendo definiciones', {
      mlCategoryId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
