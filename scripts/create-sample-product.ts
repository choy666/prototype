#!/usr/bin/env tsx

import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../lib/db.js';
import { products, categories } from '../lib/schema.js';
import { eq, sql } from 'drizzle-orm';

async function createSampleProduct() {
  try {
    console.log('🔍 Verificando si la categoría existe...');
    // Crear o usar categoría por defecto
    let categoryId = 1; // Asumir categoría por defecto
    const categoriesList = await db.select().from(categories).limit(1);
    if (categoriesList.length > 0) {
      categoryId = categoriesList[0].id;
    } else {
      // Crear categoría por defecto si no existe
      const [newCategory] = await db.insert(categories).values({
        name: 'Electrónicos',
        description: 'Productos electrónicos'
      }).returning();
      categoryId = newCategory.id;
    }

    console.log('🔍 Verificando si el producto 24 existe...');
    const existingProduct = await db.select().from(products).where(eq(products.id, 24));
    if (existingProduct.length > 0) {
      console.log('✅ Producto 24 ya existe.');
      return;
    }

    console.log('📝 Creando producto de muestra con ID 24...');
    // Set sequence to 23 so next insert gets ID 24
    await db.execute(sql`SELECT setval('products_id_seq', 23, false);`);

    const [newProduct] = await db.insert(products).values({
      name: 'Producto de Prueba',
      description: 'Este es un producto de prueba para la página de stock.',
      price: '99.99',
      image: 'https://via.placeholder.com/300x300?text=Producto+24',
      images: ['https://via.placeholder.com/300x300?text=Producto+24'],
      categoryId,
      category: 'Electrónicos',
      destacado: false,
      stock: 100,
      discount: 0,
      weight: '1.5',
      attributes: {}
    }).returning();

    console.log('✅ Producto creado exitosamente con ID:', newProduct.id);
  } catch (error) {
    console.error('❌ Error al crear producto:', error);
    // Si falla el ID específico, crear sin ID y renombrar o algo, pero por ahora error
  }
}

createSampleProduct().catch(console.error);
