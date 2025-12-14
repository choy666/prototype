import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, categories } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { validateMLRequiredAttributes } from '@/lib/validations/ml-attributes';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    
    if (!productId) {
      return NextResponse.json({ error: 'Se requiere productId' }, { status: 400 });
    }
    
    // Obtener el producto con sus atributos
    const product = await db.query.products.findFirst({
      where: eq(products.id, parseInt(productId)),
      columns: {
        id: true,
        name: true,
        mlCategoryId: true,
        attributes: true,
      }
    });
    
    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    
    if (!product.mlCategoryId) {
      return NextResponse.json({ error: 'El producto no tiene categoría ML' }, { status: 400 });
    }
    
    // Obtener la categoría con sus atributos requeridos
    const category = await db.query.categories.findFirst({
      where: eq(categories.mlCategoryId, product.mlCategoryId),
      columns: {
        name: true,
        attributes: true,
      }
    });
    
    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }
    
    // Validar atributos
    const validation = await validateMLRequiredAttributes(
      product.mlCategoryId,
      product.attributes as Record<string, unknown> || {}
    );
    
    // Mostrar información detallada
    const mlAttributes = category.attributes as Array<{ id: string; tags: string[] }> || [];
    const requiredAttributes = mlAttributes.filter(attr => attr.tags?.includes('required'));
    const conditionalAttributes = mlAttributes.filter(attr => attr.tags?.includes('conditional_required'));
    
    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        mlCategoryId: product.mlCategoryId,
        currentAttributes: product.attributes,
      },
      category: {
        name: category.name,
        totalAttributes: mlAttributes.length,
        requiredAttributes: requiredAttributes.map(attr => attr.id),
        conditionalAttributes: conditionalAttributes.map(attr => attr.id),
      },
      validation: {
        isValid: validation.isValid,
        missingAttributes: validation.missingAttributes,
        conditionalAttributes: validation.conditionalAttributes,
        warnings: validation.warnings,
      },
      debug: {
        productAttributesKeys: Object.keys(product.attributes || {}),
        requiredAttributesDetails: requiredAttributes,
        conditionalAttributesDetails: conditionalAttributes,
      }
    });
    
  } catch (error) {
    console.error('Error en debug de atributos:', error);
    return NextResponse.json({ 
      error: 'Error interno',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
