import { db } from '../db';
import { categories } from '../schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

interface MLAttribute {
  id: string;
  tags?: string[];
  valueType?: string;
}

interface ValidationResult {
  isValid: boolean;
  missingAttributes: string[];
  conditionalAttributes: string[];
  warnings: string[];
}

/**
 * Valida que un producto tenga todos los atributos requeridos para su categoría ML
 */
export async function validateMLRequiredAttributes(
  categoryId: string,
  productAttributes: Record<string, unknown>
): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    missingAttributes: [],
    conditionalAttributes: [],
    warnings: []
  };

  try {
    // Obtener categoría con sus atributos
    const category = await db.query.categories.findFirst({
      where: eq(categories.mlCategoryId, categoryId),
      columns: {
        attributes: true,
        name: true
      }
    });

    if (!category) {
      logger.error('[ML Attributes] Categoría no encontrada', { categoryId });
      result.isValid = false;
      result.missingAttributes.push('Categoría no encontrada');
      return result;
    }

    const mlAttributes: MLAttribute[] = category.attributes as Array<{ id: string; tags: string[]; valueType?: string }> || [];
    
    // Buscar atributos requeridos y condicionalmente requeridos
    const requiredAttributes = mlAttributes.filter(attr => {
      // Asegurarse de que tags sea un array
      const tags = Array.isArray(attr.tags) ? attr.tags : [];
      return tags.includes('required');
    });
    
    const conditionalRequired = mlAttributes.filter(attr => {
      // Asegurarse de que tags sea un array
      const tags = Array.isArray(attr.tags) ? attr.tags : [];
      return tags.includes('conditional_required');
    });

    logger.info('[ML Attributes] Validando producto', {
      categoryId,
      categoryName: category.name,
      totalAttributes: mlAttributes.length,
      requiredCount: requiredAttributes.length,
      conditionalCount: conditionalRequired.length
    });

    // Validar atributos requeridos
    for (const attr of requiredAttributes) {
      if (!productAttributes[attr.id]) {
        result.isValid = false;
        result.missingAttributes.push(attr.id);
        logger.warn('[ML Attributes] Falta atributo requerido', {
          categoryId,
          attributeId: attr.id
        });
      }
    }

    // Validar atributos condicionalmente requeridos
    for (const attr of conditionalRequired) {
      if (!productAttributes[attr.id]) {
        result.conditionalAttributes.push(attr.id);
        
        // Para GTIN, ofrecer alternativa NO_GTIN
        if (attr.id === 'GTIN') {
          result.warnings.push(
            'El atributo GTIN es requerido para esta categoría. ' +
            'Si el producto no tiene código de barras, use GTIN_TYPE=NO_GTIN'
          );
        } else {
          result.warnings.push(
            `El atributo ${attr.id} es condicionalmente requerido para esta categoría`
          );
        }
        
        logger.warn('[ML Attributes] Falta atributo condicional', {
          categoryId,
          attributeId: attr.id
        });
      }
    }

    // Si hay warnings pero no errores críticos, considerar válido
    if (result.missingAttributes.length === 0 && result.conditionalAttributes.length > 0) {
      result.isValid = true;
    }

    return result;
  } catch (error) {
    logger.error('[ML Attributes] Error validando atributos', {
      categoryId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    result.isValid = false;
    result.missingAttributes.push('Error al validar atributos');
    return result;
  }
}

/**
 * Prepara los atributos del producto para ML, agregando defaults necesarios
 */
export function prepareMLAttributes(
  productAttributes: Record<string, unknown>,
  validation: ValidationResult
): Array<{ id: string; value_name: string }> {
  const additionalAttributes: Array<{ id: string; value_name: string }> = [];

  // Si falta GTIN pero es condicional, agregar NO_GTIN
  if (validation.conditionalAttributes.includes('GTIN') && !productAttributes.GTIN) {
    additionalAttributes.push({
      id: 'GTIN_TYPE',
      value_name: 'NO_GTIN'
    });
    logger.info('[ML Attributes] Agregando GTIN_TYPE=NO_GTIN como fallback');
  }

  return additionalAttributes;
}
