'use server';

import { db } from '../db';
import { categories } from '../schema';
import { eq, desc, like } from 'drizzle-orm';
import type { NewCategory, Category } from '../schema';
import { revalidatePath } from 'next/cache';
import { MercadoLibreAuth } from '../auth/mercadolibre';

// Obtener todas las categorías
export async function getCategories(search?: string): Promise<Category[]> {
  try {
    return await db.select().from(categories).where(search ? like(categories.name, `%${search}%`) : undefined).orderBy(desc(categories.created_at));
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

// Sincronizar categorías de Mercado Libre
export async function syncMLCategories(): Promise<{
  created: number;
  updated: number;
  errors: number;
  totalCategories: number;
}> {
  try {
    // Obtener categorías de Mercado Libre para Argentina (MLA)
    const apiUrl = 'https://api.mercadolibre.com/sites/MLA/categories'
    console.log('🔄 Fetching ML categories from:', apiUrl)
    
    // Obtener token de acceso de Mercado Libre
    const mlAuth = new MercadoLibreAuth()
    const accessToken = await mlAuth.getAccessToken()
    
    if (!accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Mercado Libre')
    }
    
    const mlResponse = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        'Referer': 'https://www.mercadolibre.com.ar/',
        'Origin': 'https://www.mercadolibre.com.ar'
      }
    })
    console.log('📊 ML API Response Status:', mlResponse.status, mlResponse.statusText)
    
    if (!mlResponse.ok) {
      const errorText = await mlResponse.text()
      console.error('❌ ML API Error Response:', errorText)
      throw new Error(`Failed to fetch ML categories: ${mlResponse.status} ${mlResponse.statusText}`)
    }

    const mlCategories = await mlResponse.json() as Array<{ id: string; name: string }>

    // Sincronizar categorías con la base de datos
    const syncResults = {
      created: 0,
      updated: 0,
      errors: 0
    }

    for (const mlCategory of mlCategories) {
      try {
        // Verificar si la categoría ya existe
        const existingCategory = await db.select()
          .from(categories)
          .where(eq(categories.mlCategoryId, mlCategory.id))
          .limit(1)

        if (existingCategory.length === 0) {
          // Crear nueva categoría
          await db.insert(categories).values({
            name: mlCategory.name,
            mlCategoryId: mlCategory.id,
            isMlOfficial: true
          })
          syncResults.created++
        } else {
          // Actualizar categoría existente
          await db.update(categories)
            .set({ 
              name: mlCategory.name,
              isMlOfficial: true,
              updated_at: new Date()
            })
            .where(eq(categories.mlCategoryId, mlCategory.id))
          syncResults.updated++
        }
      } catch (error) {
        console.error(`Error syncing category ${mlCategory.id}:`, error)
        syncResults.errors++
      }
    }

    revalidatePath('/admin/categories');
    return {
      ...syncResults,
      totalCategories: mlCategories.length
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
