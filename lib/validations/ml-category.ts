import { db } from '@/lib/db';
import { categories } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Valida que una categoría de Mercado Libre sea una categoría hoja válida y oficial
 * @param mlCategoryId ID de la categoría de Mercado Libre (ej: MLA3530)
 * @returns Promise<boolean> true si la categoría es válida, false si no
 */
export async function validateMLCategory(mlCategoryId: string): Promise<boolean> {
  if (!mlCategoryId) {
    return false;
  }

  try {
    const categoryRecord = await db.query.categories.findFirst({
      where: and(
        eq(categories.mlCategoryId, mlCategoryId),
        eq(categories.isLeaf, true),
        eq(categories.isMlOfficial, true)
      ),
    });
    
    return !!categoryRecord;
  } catch (error) {
    console.error('Error validando categoría ML:', error);
    return false;
  }
}

/**
 * Crea un objeto de respuesta de error para categorías ML inválidas
 * @param mlCategoryId ID de la categoría que falló la validación
 * @returns Objeto de respuesta con error 400
 */
export function createMLCategoryErrorResponse(mlCategoryId: string) {
  return {
    error: 'La categoría de Mercado Libre seleccionada no es una categoría hoja válida. Por favor, seleccione una categoría oficial.',
    mlCategoryId,
  };
}
