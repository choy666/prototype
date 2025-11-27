 'use server';

import { db } from '../db';
import { productAttributes } from '../schema';
import type { ProductAttribute } from '../schema';
import { eq, like, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type ProductAttributeValue = {
  name: string;
  mlValueId?: string | null;
};

export type ProductAttributePayload = {
  name: string;
  mlAttributeId?: string | null;
  values: ProductAttributeValue[];
};

const baseQuery = db.select().from(productAttributes);

export async function getProductAttributes(search?: string): Promise<ProductAttribute[]> {
  try {
    const query = baseQuery.where(search ? like(productAttributes.name, `%${search}%`) : undefined).orderBy(asc(productAttributes.name));
    return await query;
  } catch (error) {
    console.error('Error fetching product attributes:', error);
    throw new Error('No se pudieron obtener los atributos de producto');
  }
}

export async function getProductAttributeById(id: number): Promise<ProductAttribute | null> {
  try {
    const [attribute] = await baseQuery.where(eq(productAttributes.id, id));
    return attribute || null;
  } catch (error) {
    console.error('Error fetching product attribute by id:', error);
    throw new Error('No se pudo obtener el atributo de producto');
  }
}

export async function createProductAttribute(data: ProductAttributePayload): Promise<ProductAttribute> {
  try {
    const values = Array.isArray(data.values) ? data.values : [];
    const [newAttribute] = await db.insert(productAttributes).values({
      name: data.name.trim(),
      mlAttributeId: data.mlAttributeId?.trim() || null,
      values,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning();
    revalidatePath('/admin/product-attributes');
    return newAttribute;
  } catch (error) {
    console.error('Error creating product attribute:', error);
    throw new Error('No se pudo crear el atributo de producto');
  }
}

export async function updateProductAttribute(id: number, data: Partial<ProductAttributePayload>): Promise<ProductAttribute | null> {
  try {
    const [updatedAttribute] = await db.update(productAttributes).set({
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.mlAttributeId !== undefined ? { mlAttributeId: data.mlAttributeId ? data.mlAttributeId.trim() : null } : {}),
      ...(data.values !== undefined ? { values: Array.isArray(data.values) ? data.values : [] } : {}),
      updated_at: new Date(),
    }).where(eq(productAttributes.id, id)).returning();
    revalidatePath(`/admin/product-attributes/${id}`);
    revalidatePath('/admin/product-attributes');
    return updatedAttribute || null;
  } catch (error) {
    console.error('Error updating product attribute:', error);
    throw new Error('No se pudo actualizar el atributo de producto');
  }
}

export async function deleteProductAttribute(id: number): Promise<boolean> {
  try {
    const [deletedAttribute] = await db
      .delete(productAttributes)
      .where(eq(productAttributes.id, id))
      .returning({ id: productAttributes.id });

    revalidatePath('/admin/product-attributes');
    return !!deletedAttribute;
  } catch (error) {
    console.error('Error deleting product attribute:', error);
    throw new Error('No se pudo eliminar el atributo de producto');
  }
}
