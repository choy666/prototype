import { db } from '../lib/db';
import { productVariants } from '../lib/schema';
import { eq } from 'drizzle-orm';

/**
 * Script de migración para convertir el campo 'image' (string) a 'images' (array)
 * en la tabla product_variants.
 *
 * Este script debe ejecutarse UNA SOLA VEZ después de actualizar el schema.
 */

async function migrateVariantImages() {
  console.log('🚀 Iniciando migración de imágenes de variantes...');

  try {
    // Obtener todas las variantes que tienen imagen (no null/undefined)
    const variantsWithImages = await db
      .select({
        id: productVariants.id,
        image: productVariants.image,
      })
      .from(productVariants)
      .where(eq(productVariants.isActive, true));

    console.log(`📊 Encontradas ${variantsWithImages.length} variantes con imágenes para migrar`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const variant of variantsWithImages) {
      if (!variant.image || variant.image.trim() === '') {
        console.log(`⏭️  Saltando variante ${variant.id}: imagen vacía`);
        skippedCount++;
        continue;
      }

      // Convertir la imagen única a un array
      const imagesArray = [variant.image.trim()];

      // Actualizar la variante con el nuevo campo images
      await db
        .update(productVariants)
        .set({
          images: imagesArray,
          updated_at: new Date(),
        })
        .where(eq(productVariants.id, variant.id));

      console.log(`✅ Migrada variante ${variant.id}: "${variant.image}" → [${imagesArray.join(', ')}]`);
      migratedCount++;
    }

    console.log('\n📈 Resumen de migración:');
    console.log(`   ✅ Migradas: ${migratedCount} variantes`);
    console.log(`   ⏭️  Saltadas: ${skippedCount} variantes`);
    console.log(`   📊 Total procesadas: ${migratedCount + skippedCount} variantes`);

    // Verificación final
    const totalVariants = await db
      .select({ count: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.isActive, true));

    const variantsWithImagesArray = await db
      .select({ count: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.isActive, true));

    console.log('\n🔍 Verificación:');
    console.log(`   Total variantes activas: ${totalVariants.length}`);
    console.log(`   Variantes con imágenes (array): ${variantsWithImagesArray.length}`);

    console.log('\n🎉 Migración completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar la migración
migrateVariantImages()
  .then(() => {
    console.log('🏁 Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
