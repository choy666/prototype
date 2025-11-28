import { logger } from '@/lib/utils/logger';
import { db } from '@/lib/db';
import { products } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export interface ProductME2ValidationResult {
  productId: number;
  productName: string;
  isValid: boolean;
  missingAttributes: string[];
  warnings: string[];
  canUseME2: boolean;
}

export interface ME2ValidationSummary {
  totalProducts: number;
  validProducts: number;
  invalidProducts: number;
  warnings: string[];
  products: ProductME2ValidationResult[];
}

// Validar atributos obligatorios ME2 para un producto
export async function validateProductME2Attributes(productId: number): Promise<ProductME2ValidationResult> {
  try {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: {
        id: true,
        name: true,
        weight: true,
        height: true,
        width: true,
        length: true,
        shippingMode: true,
        shippingAttributes: true,
        me2Compatible: true,
        mlItemId: true,
      }
    });

    if (!product) {
      return {
        productId,
        productName: 'Producto no encontrado',
        isValid: false,
        missingAttributes: ['product_exists'],
        warnings: ['Producto no existe en la base de datos'],
        canUseME2: false,
      };
    }

    const missingAttributes: string[] = [];
    const warnings: string[] = [];

    // Validar peso (obligatorio para ME2)
    if (!product.weight || Number(product.weight) <= 0) {
      missingAttributes.push('weight');
      warnings.push('⚠️ Peso no configurado o inválido (requerido para ME2)');
    }

    // Validar dimensiones (obligatorias para ME2)
    const dimensions = ['height', 'width', 'length'];
    for (const dim of dimensions) {
      const value = product[dim as keyof typeof product];
      if (!value || Number(value) <= 0) {
        missingAttributes.push(dim);
        warnings.push(`⚠️ Dimensión ${dim} no configurada o inválida (requerida para ME2)`);
      }
    }

    // Validar modo de envío
    if (!product.shippingMode) {
      missingAttributes.push('shipping_mode');
      warnings.push('⚠️ Modo de envío no configurado (recomendado: me2)');
    } else if (product.shippingMode !== 'me2') {
      warnings.push(`⚠️ Modo de envío configurado como "${product.shippingMode}" (recomendado: me2)`);
    }

    // Validar atributos de envío
    if (!product.shippingAttributes) {
      missingAttributes.push('shipping_attributes');
      warnings.push('⚠️ Atributos de envío no configurados');
    }

    // Validar compatibilidad ME2 explícita
    if (product.me2Compatible !== true) {
      missingAttributes.push('me2_compatible');
      warnings.push('⚠️ Producto no marcado como compatible con ME2');
    }

    // Validar que tenga itemId de Mercado Libre (necesario para cálculo real)
    if (!product.mlItemId) {
      warnings.push('⚠️ Producto sin ML Item ID - usará fallback local para envíos');
    }

    const isValid = missingAttributes.length === 0;
    const canUseME2: boolean = isValid && !!product.mlItemId && product.me2Compatible === true;

    if (!isValid) {
      logger.warn('[ME2] Validación: Producto con atributos incompletos', {
        productId,
        productName: product.name,
        missingAttributes,
        warnings,
        canUseME2
      });
    }

    return {
      productId,
      productName: product.name || 'Sin nombre',
      isValid,
      missingAttributes,
      warnings,
      canUseME2,
    };

  } catch (error) {
    logger.error('[ME2] Validación: Error validando producto', {
      productId,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      productId,
      productName: 'Error al cargar',
      isValid: false,
      missingAttributes: ['validation_error'],
      warnings: [`Error validando producto: ${error instanceof Error ? error.message : String(error)}`],
      canUseME2: false,
    };
  }
}

// Validar múltiples productos (usado en cálculo de envío)
export async function validateProductsForME2Shipping(productIds: number[]): Promise<{
  allValid: boolean;
  results: ProductME2ValidationResult[];
  warnings: string[];
}> {
  const results = await Promise.all(
    productIds.map(id => validateProductME2Attributes(id))
  );

  const allValid = results.every(r => r.isValid);
  const warnings = results.flatMap(r => r.warnings);

  if (!allValid) {
    logger.warn('[ME2] Validación: Productos con atributos ME2 incompletos', {
      productIds,
      invalidCount: results.filter(r => !r.isValid).length,
      warnings: warnings.slice(0, 10) // Limitar logs a primeros 10 warnings
    });
  }

  return {
    allValid,
    results,
    warnings,
  };
}

// Obtener resumen de validación para admin dashboard
export async function getME2ValidationSummary(): Promise<ME2ValidationSummary> {
  try {
    // Obtener todos los productos activos
    const allProducts = await db.query.products.findMany({
      columns: {
        id: true,
        name: true,
        weight: true,
        height: true,
        width: true,
        length: true,
        shippingMode: true,
        shippingAttributes: true,
        me2Compatible: true,
        mlItemId: true,
      }
    });

    const productIds = allProducts.map(p => p.id);
    const validationResults = await Promise.all(
      productIds.map(id => validateProductME2Attributes(id))
    );

    const validProducts = validationResults.filter(r => r.isValid).length;
    const invalidProducts = validationResults.filter(r => !r.isValid).length;
    const allWarnings = validationResults.flatMap(r => r.warnings);

    logger.info('[ME2] Validación: Resumen completo obtenido', {
      totalProducts: allProducts.length,
      validProducts,
      invalidProducts,
      warningsCount: allWarnings.length
    });

    return {
      totalProducts: allProducts.length,
      validProducts,
      invalidProducts,
      warnings: allWarnings,
      products: validationResults,
    };

  } catch (error) {
    logger.error('[ME2] Validación: Error obteniendo resumen', {
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      totalProducts: 0,
      validProducts: 0,
      invalidProducts: 0,
      warnings: [`Error obteniendo resumen: ${error instanceof Error ? error.message : String(error)}`],
      products: [],
    };
  }
}

// Función helper para obtener dimensiones seguras con validación ME2
export async function getValidatedME2Dimensions(productIds: number[]): Promise<{
  dimensions: {
    height: number;
    width: number;
    length: number;
    weight: number;
  };
  validationWarnings: string[];
  hasInvalidProducts: boolean;
}> {
  const validation = await validateProductsForME2Shipping(productIds);
  
  // Calcular dimensiones totales usando valores por defecto si faltan
  let totalHeight = 0;
  let totalWidth = 0;
  let totalLength = 0;
  let totalWeight = 0;

  for (const productId of productIds) {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: {
        height: true,
        width: true,
        length: true,
        weight: true
      }
    });

    if (product) {
      const height = Number(product.height) || 10;
      const width = Number(product.width) || 10;
      const length = Number(product.length) || 10;
      const weight = Number(product.weight) || 0.5;

      // Acumular dimensiones (lógica simplificada)
      totalLength = Math.max(totalLength, length);
      totalWidth = Math.max(totalWidth, width);
      totalHeight += height;
      totalWeight += weight;
    }
  }

  return {
    dimensions: {
      height: totalHeight,
      width: totalWidth,
      length: totalLength,
      weight: totalWeight,
    },
    validationWarnings: validation.warnings,
    hasInvalidProducts: !validation.allValid,
  };
}
