import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { products } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

/**
 * Endpoint temporal para corregir atributos de productos existentes
 * Mapea los nombres de atributos a IDs correctos de Mercado Libre
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 });
    }

    // Obtener el producto actual
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    if (!product.attributes || !product.mlCategoryId) {
      return NextResponse.json({ 
        error: 'El producto no tiene atributos o categoría ML' 
      }, { status: 400 });
    }

    // Importar la función de mapeo
    const { mapAttributesToMLIds } = await import('@/lib/actions/products');

    // Mapear atributos a IDs correctos
    const originalAttributes = product.attributes as Array<{ name: string; values: string[] }>;
    const mappedAttributes = await mapAttributesToMLIds(originalAttributes, product.mlCategoryId);

    // Actualizar el producto
    const [updatedProduct] = await db
      .update(products)
      .set({
        attributes: mappedAttributes,
        updated_at: new Date(),
      })
      .where(eq(products.id, productId))
      .returning();

    logger.info('Producto actualizado con atributos mapeados', {
      productId,
      originalCount: originalAttributes.length,
      mappedCount: mappedAttributes.length,
    });

    return NextResponse.json({
      success: true,
      product: updatedProduct,
      originalAttributes,
      mappedAttributes,
    });
  } catch (error) {
    logger.error('Error corrigiendo atributos del producto', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
