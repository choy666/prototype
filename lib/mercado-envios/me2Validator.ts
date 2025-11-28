import { logger } from '@/lib/utils/logger';
import { db } from '@/lib/db';

export interface Product {
  id: number;
  name?: string;
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
  shippingMode?: string;
  shippingAttributes?: Record<string, unknown>;
  me2Compatible?: boolean;
  mlItemId?: string;
  quantity?: number;
  price?: number;
}

export interface ProductForCalculation extends Product {
  quantity: number;
  price: number;
}

export interface ProductME2ValidationResult {
  productId: number;
  productName: string;
  canUseME2: boolean;
  missingAttributes: string[];
  warnings: string[];
  isValid: boolean;
}

export interface ME2CalculationRequest {
  zipcode: string;
  items: ProductForCalculation[];
  dimensions?: ME2Dimensions;
  allowFallback?: boolean;
}

export interface ME2ValidationResult {
  canUseME2: boolean;
  reason?: string;
  missingAttributes: string[];
  warnings: string[];
  dimensions?: ME2Dimensions;
}

export interface ME2Dimensions {
  weight: number;
  height: number;
  width: number;
  length: number;
}

export interface ME2ValidationSummary {
  totalProducts: number;
  validProducts: number;
  invalidProducts: number;
  warnings: string[];
  products: ProductME2ValidationResult[];
}

// Constantes para validación ME2
const ME2_MIN_DIMENSIONS = {
  weight: 0.1, // gramos
  height: 1,   // cm
  width: 1,    // cm
  length: 1,   // cm
};

const ME2_DEFAULT_DIMENSIONS = {
  weight: 500,  // gramos
  height: 10,   // cm
  width: 10,    // cm
  length: 10,   // cm
};

// Validar un producto individual para ME2
export async function validateProductForME2(product: Product): Promise<ProductME2ValidationResult> {
  const missingAttributes: string[] = [];
  const warnings: string[] = [];

  // Validar peso
  if (!product.weight || product.weight <= ME2_MIN_DIMENSIONS.weight) {
    missingAttributes.push('weight');
    warnings.push(`⚠️ Peso inválido (< ${ME2_MIN_DIMENSIONS.weight}g)`);
  }

  // Validar dimensiones
  ['height', 'width', 'length'].forEach((dim) => {
    const value = product[dim as keyof Product] as number;
    if (!value || value <= ME2_MIN_DIMENSIONS[dim as keyof typeof ME2_MIN_DIMENSIONS]) {
      missingAttributes.push(dim);
      warnings.push(`⚠️ Dimensión ${dim} inválida (< ${ME2_MIN_DIMENSIONS[dim as keyof typeof ME2_MIN_DIMENSIONS]}cm)`);
    }
  });

  // Validar itemId de Mercado Libre (crítico para ME2 real)
  if (!product.mlItemId) {
    warnings.push('⚠️ Producto sin ML Item ID - usará fallback local');
  }

  // Validar compatibilidad ME2 explícita
  if (product.me2Compatible !== true) {
    warnings.push('⚠️ Producto no marcado como compatible con ME2');
  }

  const isValid = missingAttributes.length === 0;
  const canUseME2 = isValid && !!product.mlItemId && product.me2Compatible === true;

  if (!isValid) {
    logger.warn('[ME2] Validación: Producto con atributos incompletos', {
      productId: product.id,
      productName: product.name,
      missingAttributes,
      warnings: warnings.slice(0, 3) // Limitar logs
    });
  }

  return {
    productId: product.id,
    productName: product.name || 'Sin nombre',
    canUseME2,
    missingAttributes,
    warnings,
    isValid,
  };
}

// Validar múltiples productos para cálculo ME2
export async function validateProductsForME2(products: Product[]): Promise<{
  allValid: boolean;
  results: ProductME2ValidationResult[];
  warnings: string[];
}> {
  const results = await Promise.all(
    products.map(product => validateProductForME2(product))
  );

  const allValid = results.every(r => r.isValid);
  const warnings = results.flatMap(r => r.warnings);

  if (!allValid) {
    logger.warn('[ME2] Validación: Productos con atributos ME2 incompletos', {
      productIds: products.map(p => p.id),
      invalidCount: results.filter(r => !r.isValid).length,
      warnings: warnings.slice(0, 10)
    });
  }

  return { allValid, results, warnings };
}

// Calcular dimensiones totales con heurística
export function calculateDimensions(products: Product[]): ME2Dimensions {
  let totalHeight = 0;
  let maxWidth = 0;
  let maxLength = 0;
  let totalWeight = 0;

  for (const product of products) {
    // Usar dimensiones reales o defaults según validación
    const height = product.height || ME2_DEFAULT_DIMENSIONS.height;
    const width = product.width || ME2_DEFAULT_DIMENSIONS.width;
    const length = product.length || ME2_DEFAULT_DIMENSIONS.length;
    const weight = product.weight || ME2_DEFAULT_DIMENSIONS.weight;

    // Lógica de box-packing simplificada
    totalHeight += height;
    maxWidth = Math.max(maxWidth, width);
    maxLength = Math.max(maxLength, length);
    totalWeight += weight;
  }

  const dimensions = {
    height: totalHeight,
    width: maxWidth,
    length: maxLength,
    weight: totalWeight,
  };

  logger.info('[ME2] Dimensiones calculadas', {
    productCount: products.length,
    dimensions,
    usesDefaults: products.some(p => !p.height || !p.width || !p.length || !p.weight)
  });

  return dimensions;
}

// Validación completa para solicitud de cálculo ME2
export async function validateME2Calculation(request: ME2CalculationRequest): Promise<ME2ValidationResult> {
  const { items, allowFallback = false } = request;

  // Validar productos
  const productValidation = await validateProductsForME2(items);
  
  // Si hay productos inválidos y no se permite fallback, rechazar
  if (!productValidation.allValid && !allowFallback) {
    const missingAttributes = productValidation.results
      .filter(r => !r.isValid)
      .flatMap(r => r.missingAttributes);

    return {
      canUseME2: false,
      reason: 'MISSING_ATTRIBUTES',
      missingAttributes,
      warnings: productValidation.warnings,
    };
  }

  // Verificar que todos los productos tengan ML Item ID para ME2 real
  const productsWithoutMLId = items.filter(p => !p.mlItemId);
  if (productsWithoutMLId.length > 0 && !allowFallback) {
    return {
      canUseME2: false,
      reason: 'NO_ML_ITEM_ID',
      missingAttributes: ['mlItemId'],
      warnings: [`${productsWithoutMLId.length} productos sin ML Item ID`],
    };
  }

  // Verificar compatibilidad ME2 explícita
  const incompatibleProducts = items.filter(p => p.me2Compatible !== true);
  if (incompatibleProducts.length > 0 && !allowFallback) {
    return {
      canUseME2: false,
      reason: 'NOT_COMPATIBLE',
      missingAttributes: ['me2Compatible'],
      warnings: [`${incompatibleProducts.length} productos no compatibles con ME2`],
    };
  }

  // Calcular dimensiones
  const dimensions = request.dimensions || calculateDimensions(items);

  // Si llegamos aquí, podemos usar ME2 (o fallback si hay advertencias)
  const canUseME2 = productValidation.allValid && 
                    productsWithoutMLId.length === 0 && 
                    incompatibleProducts.length === 0;

  return {
    canUseME2,
    reason: canUseME2 ? 'VALID' : undefined,
    missingAttributes: canUseME2 ? [] : productValidation.results
      .filter(r => !r.isValid)
      .flatMap(r => r.missingAttributes),
    warnings: productValidation.warnings,
    dimensions,
  };
}

// Obtener resumen para dashboard admin
export async function getME2ValidationSummary(): Promise<ME2ValidationSummary> {
  try {
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

    const validationResults = await Promise.all(
      allProducts.map((product: Record<string, unknown>): Promise<ProductME2ValidationResult> => 
        validateProductForME2({
          id: product.id as number,
          name: product.name as string,
          weight: product.weight ? Number(product.weight) : undefined,
          height: product.height ? Number(product.height) : undefined,
          width: product.width ? Number(product.width) : undefined,
          length: product.length ? Number(product.length) : undefined,
          shippingMode: product.shippingMode as string || undefined,
          shippingAttributes: product.shippingAttributes as Record<string, unknown> || undefined,
          me2Compatible: product.me2Compatible as boolean || false,
          mlItemId: product.mlItemId as string || undefined,
          quantity: product.quantity ? Number(product.quantity) : 0,
          price: product.price ? Number(product.price) : 0,
        } as ProductForCalculation)
      )
    );

    const validProducts = validationResults.filter(r => r.isValid).length;
    const invalidProducts = validationResults.filter(r => !r.isValid).length;
    const allWarnings = validationResults.flatMap(r => r.warnings);

    logger.info('[ME2] Validación: Resumen obtenido', {
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

// Función helper para obtener productos desde IDs
export async function getProductsByIds(productIds: number[]): Promise<Product[]> {
  const dbProducts = await db.query.products.findMany({
    where: (products, { inArray }) => inArray(products.id, productIds),
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

  // Convertir DB types a Product types
  const products: Product[] = dbProducts.map((product: Record<string, unknown>): Product => ({
    id: product.id as number,
    name: product.name as string,
    weight: product.weight ? Number(product.weight) : undefined,
    height: product.height ? Number(product.height) : undefined,
    width: product.width ? Number(product.width) : undefined,
    length: product.length ? Number(product.length) : undefined,
    shippingMode: product.shippingMode as string || undefined,
    shippingAttributes: product.shippingAttributes as Record<string, unknown> || undefined,
    me2Compatible: product.me2Compatible as boolean || false,
    mlItemId: product.mlItemId as string || undefined,
  }));

  return products;
}
