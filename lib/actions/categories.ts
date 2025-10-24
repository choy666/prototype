'use server';

import { db } from '../db';
import { categories } from '../schema';
import { eq, desc } from 'drizzle-orm';
import type { NewCategory, Category } from '../schema';
import { revalidatePath } from 'next/cache';

// Obtener todas las categorías
export async function getCategories(): Promise<Category[]> {
  try {
    return await db
      .select()
      .from(categories)
      .orderBy(desc(categories.created_at));
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
