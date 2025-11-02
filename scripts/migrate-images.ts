import { db } from '../lib/db';
import { products } from '../lib/schema';
import { eq, sql } from 'drizzle-orm';

async function migrateImages() {
  console.log('Iniciando migración de imágenes...');

  try {
    // Obtener productos donde images es string (no array)
    const productsToMigrate = await db
      .select({ id: products.id, images: products.images })
      .from(products)
      .where(sql`jsonb_typeof(${products.images}) = 'string'`);

    console.log(`Encontrados ${productsToMigrate.length} productos para migrar`);

    for (const product of productsToMigrate) {
      const imagesString = product.images as string;
      const imagesArray = imagesString.split(',').map(s => s.trim()).filter(s => s.length > 0);

      await db
        .update(products)
        .set({ images: imagesArray })
        .where(eq(products.id, product.id));

      console.log(`Migrado producto ${product.id}: "${imagesString}" -> ${JSON.stringify(imagesArray)}`);
    }

    console.log('Migración completada exitosamente');
  } catch (error) {
    console.error('Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar la migración
migrateImages().then(() => {
  console.log('Script finalizado');
  process.exit(0);
});
