export type CategoryAttributeTag = {
  required?: boolean
  catalog_required?: boolean
  allow_variations?: boolean
  conditional_required?: boolean
  [key: string]: unknown
}

export interface CategoryAttributeValue {
  id?: string
  name: string
}

export interface CategoryAttributeDefinition {
  id: string
  name?: string
  type?: string
  tags?: CategoryAttributeTag
  value_type?: string
  values?: CategoryAttributeValue[]
  allowed_units?: string[]
  default_unit?: string
  max_length?: number
  min_value?: number
  max_value?: number
  required_by?: unknown
  restrictions?: unknown
  variation_attribute?: boolean
  help_value?: string
}

export interface NormalizedProductAttribute {
  id?: string
  name?: string
  value_name?: string
  values?: string[]
}

export interface InvalidAttributeEntry {
  attribute: CategoryAttributeDefinition
  providedValue?: string
  reason: string
}

export interface AttributeRequirementResult {
  missingRequired: CategoryAttributeDefinition[]
  missingConditional: CategoryAttributeDefinition[]
  invalidValues: InvalidAttributeEntry[]
  totals: {
    required: number
    conditional: number
  }
}

function normalizeProductAttributes(input: unknown): Map<string, string> {
  const normalized = new Map<string, string>()

  if (!input) {
    return normalized
  }

  const trySetValue = (key: unknown, rawValue: unknown) => {
    if (typeof key !== 'string') return
    if (rawValue === undefined || rawValue === null) return
    const value = String(rawValue).trim()
    if (value.length === 0) return
    normalized.set(key.toLowerCase(), value)
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      if (!item || typeof item !== 'object') continue
      const attr = item as NormalizedProductAttribute
      const key = attr.id || attr.name
      if (attr.value_name) {
        trySetValue(key, attr.value_name)
        continue
      }
      if (attr.values && attr.values.length > 0) {
        trySetValue(key, attr.values[0])
        continue
      }
    }
    return normalized
  }

  if (typeof input === 'object') {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      trySetValue(key, value)
    }
  }

  return normalized
}

function isValueAllowed(attr: CategoryAttributeDefinition, value: string | undefined): boolean {
  if (!value) return false
  if (!attr.values || attr.values.length === 0) {
    return true
  }

  const normalizedValue = value.toLowerCase()
  return attr.values.some((allowed) => {
    if (allowed.id && allowed.id.toLowerCase() === normalizedValue) {
      return true
    }
    if (allowed.name && allowed.name.toLowerCase() === normalizedValue) {
      return true
    }
    return false
  })
}

export function evaluateCategoryAttributeRequirements(
  productAttributes: unknown,
  categoryAttributes: CategoryAttributeDefinition[]
): AttributeRequirementResult {
  const requiredAttrs = categoryAttributes.filter(
    (attr) => attr.tags?.required || attr.tags?.catalog_required
  )
  const conditionalAttrs = categoryAttributes.filter(
    (attr) => attr.tags?.conditional_required
  )

  const result: AttributeRequirementResult = {
    missingRequired: [],
    missingConditional: [],
    invalidValues: [],
    totals: {
      required: requiredAttrs.length,
      conditional: conditionalAttrs.length,
    },
  }

  if (!categoryAttributes || categoryAttributes.length === 0) {
    return result
  }

  const normalizedProductAttrs = normalizeProductAttributes(productAttributes)

  const assertPresence = (
    attr: CategoryAttributeDefinition,
    target: 'required' | 'conditional'
  ) => {
    if (!attr.id) return
    const hasValue = normalizedProductAttrs.has(attr.id.toLowerCase())

    if (!hasValue) {
      if (target === 'required') {
        result.missingRequired.push(attr)
      } else {
        const emptyReasonKey = `EMPTY_${attr.id}_REASON`.toLowerCase()
        if (!normalizedProductAttrs.has(emptyReasonKey)) {
          result.missingConditional.push(attr)
        }
      }
    } else {
      const providedValue = normalizedProductAttrs.get(attr.id.toLowerCase())
      if (!isValueAllowed(attr, providedValue)) {
        result.invalidValues.push({
          attribute: attr,
          providedValue,
          reason: 'Valor no permitido por la categoría',
        })
      }
    }
  }

  requiredAttrs.forEach((attr) => assertPresence(attr, 'required'))
  conditionalAttrs.forEach((attr) => assertPresence(attr, 'conditional'))

  return result
}
