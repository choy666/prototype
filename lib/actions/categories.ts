'use server';

import { db } from '../db';
import { categories } from '../schema';
import { eq, desc, like, and } from 'drizzle-orm';
import type { NewCategory, Category } from '../schema';
import { revalidatePath } from 'next/cache';
import { MercadoLibreAuth } from '../auth/mercadolibre';

// Obtener todas las categorías (solo categorías hoja para productos)
export async function getCategories(search?: string, onlyLeaf: boolean = true): Promise<Category[]> {
  try {
    // Construir condiciones dinámicamente sin reasignar el query
    const conditions = []
    
    if (search) {
      conditions.push(like(categories.name, `%${search}%`))
    }
    
    // Filtrar solo categorías hoja (se pueden usar para publicar productos)
    if (onlyLeaf) {
      conditions.push(eq(categories.isLeaf, true))
    }
    
    // Aplicar where condicionalmente sin reasignación
    const query = db.select().from(categories)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(categories.created_at))
    
    return await query
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw new Error('No se pudieron obtener las categorías');
  }
}

// Obtener categoría por ID
export async function getCategoryById(id: number): Promise<Category | null> {
  try {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || null;
  } catch (error) {
    console.error('Error fetching category by id:', error);
    throw new Error('No se pudo obtener la categoría');
  }
}

// Crear categoría
export async function createCategory(
  categoryData: Omit<NewCategory, 'id' | 'created_at' | 'updated_at'>
): Promise<Category> {
  try {
    const [newCategory] = await db
      .insert(categories)
      .values({
        ...categoryData,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    revalidatePath('/admin/categories');
    return newCategory;
  } catch (error) {
    console.error('Error creating category:', error);
    throw new Error('No se pudo crear la categoría');
  }
}

// Sincronizar las categorías oficiales de Mercado Libre (máx. 30, lista fija)
export async function syncMLCategories(): Promise<{
  created: number;
  updated: number;
  errors: number;
  totalCategories: number;
}> {
  try {
    // Obtener token de acceso de Mercado Libre
    const mlAuth = new MercadoLibreAuth()
    const accessToken = await mlAuth.getAccessToken()
    
    if (!accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Mercado Libre')
    }
    
    console.log('🔄 Starting ML categories sync (fixed list)...')
    
    // Lista fija de categorías a sincronizar (máx. 30)
    const ML_CATEGORY_IDS = [
      'MLA1055', 'MLA1652', 'MLA1002', 'MLA438566', 'MLA398582',
      'MLA1577', 'MLA431202', 'MLA1644', 'MLA109027', 'MLA373770',
      'MLA109042', 'MLA1271', 'MLA43686', 'MLA414007', 'MLA31045',
      'MLA1611', 'MLA447782', 'MLA433672', 'MLA6143', 'MLA1763',
      'MLA22195', 'MLA61177', 'MLA1161', 'MLA1386', 'MLA127684',
      'MLA1087', 'MLA8830', 'MLA409415', 'MLA8618', 'MLA3697',
    ]
    
    // Respetar límite de 30 categorías oficiales
    const existingOfficialCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.isMlOfficial, true))
    if (existingOfficialCategories.length >= 30) {
      console.warn('⚠️ Ya existen 30 o más categorías oficiales. No se agregarán más.')
      return { created: 0, updated: 0, errors: 0, totalCategories: existingOfficialCategories.length }
    }
    
    const syncResults = { created: 0, updated: 0, errors: 0 }
    
    for (const categoryId of ML_CATEGORY_IDS) {
      try {
        // Obtener detalles de la categoría desde ML
        const detailUrl = `https://api.mercadolibre.com/categories/${categoryId}`
        const detailResponse = await fetch(detailUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        })
        
        if (!detailResponse.ok) {
          console.warn(`⚠️ No se pudo obtener detalles para ${categoryId}: ${detailResponse.status}`)
          syncResults.errors++
          continue
        }
        
        const details = await detailResponse.json() as {
          id: string;
          name: string;
          children_categories?: Array<{ id: string; name: string }>
        }
        
        const isLeaf = !details.children_categories || details.children_categories.length === 0
        
        // Insertar o actualizar en BD
        const existing = await db
          .select()
          .from(categories)
          .where(eq(categories.mlCategoryId, categoryId))
          .limit(1)
        
        if (existing.length === 0) {
          await db.insert(categories).values({
            name: details.name,
            mlCategoryId: categoryId,
            isMlOfficial: true,
            isLeaf,
          })
          syncResults.created++
          console.log(`✅ Created category ${categoryId} (${details.name}) - leaf: ${isLeaf}`)
        } else {
          await db.update(categories)
            .set({
              name: details.name,
              isMlOfficial: true,
              isLeaf,
              updated_at: new Date()
            })
            .where(eq(categories.mlCategoryId, categoryId))
          syncResults.updated++
          console.log(`🔄 Updated category ${categoryId} (${details.name}) - leaf: ${isLeaf}`)
        }
        
        // Delay para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 150))
      } catch (error) {
        console.error(`❌ Error syncing category ${categoryId}:`, error)
        syncResults.errors++
      }
    }
    
    revalidatePath('/admin/categories')
    return {
      ...syncResults,
      totalCategories: ML_CATEGORY_IDS.length
    }
  } catch (error) {
    console.error('Error syncing ML categories:', error)
    throw new Error('Error al sincronizar categorías de Mercado Libre')
  }
}

// Actualizar categoría
export async function updateCategory(
  id: number,
  categoryData: Partial<Omit<NewCategory, 'id' | 'created_at'>>
): Promise<Category | null> {
  try {
    const [updatedCategory] = await db
      .update(categories)
      .set({
        ...categoryData,
        updated_at: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();

    revalidatePath(`/admin/categories/${id}`);
    revalidatePath('/admin/categories');
    return updatedCategory || null;
  } catch (error) {
    console.error('Error updating category:', error);
    throw new Error('No se pudo actualizar la categoría');
  }
}

// Eliminar categoría
export async function deleteCategory(id: number): Promise<boolean> {
  try {
    const [deletedCategory] = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });

    revalidatePath('/admin/categories');
    return !!deletedCategory;
  } catch (error) {
    console.error('Error deleting category:', error);
    throw new Error('No se pudo eliminar la categoría');
  }
}
