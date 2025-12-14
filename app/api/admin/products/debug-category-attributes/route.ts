import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { categories } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    
    if (!categoryId) {
      return NextResponse.json({ error: 'Se requiere categoryId' }, { status: 400 });
    }
    
    // Obtener la categoría con sus atributos
    const category = await db.query.categories.findFirst({
      where: eq(categories.mlCategoryId, categoryId),
      columns: {
        id: true,
        name: true,
        mlCategoryId: true,
        attributes: true,
      }
    });
    
    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }
    
    // Analizar el formato de los atributos
    const attributes = category.attributes;
    
    return NextResponse.json({
      category: {
        id: category.id,
        name: category.name,
        mlCategoryId: category.mlCategoryId,
      },
      attributesRaw: attributes,
      attributesType: typeof attributes,
      attributesIsArray: Array.isArray(attributes),
      attributesSample: Array.isArray(attributes) 
        ? attributes.slice(0, 3).map((attr, index) => ({
            index,
            id: attr.id,
            tags: attr.tags,
            tagsType: typeof attr.tags,
            tagsIsArray: Array.isArray(attr.tags),
            fullAttr: attr
          }))
        : [],
      firstAttribute: Array.isArray(attributes) && attributes.length > 0 ? attributes[0] : null,
    });
    
  } catch (error) {
    console.error('Error en debug de atributos de categoría:', error);
    return NextResponse.json({ 
      error: 'Error interno',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
