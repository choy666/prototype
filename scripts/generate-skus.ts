#!/usr/bin/env node

/**
 * Script para generar SKUs automáticos para productos
 * Los SKUs se guardan en la tabla tiendanube_product_mapping
 * Formato: PROD-{productId} para productos base
 * Formato: PROD-{productId}-VAR-{variantId} para variantes
 */

import { db } from '../lib/db';
import { products, productVariants, tiendanubeProductMapping } from '../lib/schema';
import { eq } from 'drizzle-orm';

async function generateSKUs(storeId: string) {
  console.log('🔍 Generando SKUs para productos...');
  console.log(`📦 Store ID: ${storeId}`);

  try {
    // 1. Obtener todos los productos activos
    const activeProducts = await db
      .select({
        id: products.id,
        name: products.name,
        isActive: products.isActive,
      })
      .from(products)
      .where(eq(products.isActive, true));

    console.log(`📦 Encontrados ${activeProducts.length} productos activos`);

    // 2. Generar y guardar SKUs para productos base
    for (const product of activeProducts) {
      const newSku = `PROD-${product.id}`;
      
      await db.insert(tiendanubeProductMapping)
        .values({
          storeId,
          localProductId: product.id,
          localVariantId: null, // Es producto base, no variante
          sku: newSku,
          syncStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [tiendanubeProductMapping.storeId, tiendanubeProductMapping.sku],
          set: {
            sku: newSku,
            updatedAt: new Date(),
          },
        });

      console.log(`✅ Producto ${product.id} (${product.name}) -> SKU: ${newSku}`);
    }

    // 3. Obtener todas las variantes activas
    const activeVariants = await db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        name: productVariants.name,
        isActive: productVariants.isActive,
      })
      .from(productVariants)
      .where(eq(productVariants.isActive, true));

    console.log(`📦 Encontradas ${activeVariants.length} variantes activas`);

    // 4. Generar y guardar SKUs para variantes
    for (const variant of activeVariants) {
      const newSku = `PROD-${variant.productId}-VAR-${variant.id}`;
      
      await db.insert(tiendanubeProductMapping)
        .values({
          storeId,
          localProductId: variant.productId,
          localVariantId: variant.id,
          sku: newSku,
          syncStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [tiendanubeProductMapping.storeId, tiendanubeProductMapping.localVariantId],
          set: {
            sku: newSku,
            updatedAt: new Date(),
          },
        });

      console.log(`✅ Variante ${variant.id} (${variant.name}) -> SKU: ${newSku}`);
    }

    // 5. Verificar resultado
    const mappings = await db.query.tiendanubeProductMapping.findMany({
      where: eq(tiendanubeProductMapping.storeId, storeId),
    });

    console.log('\n📋 Resumen de SKUs Generados:');
    console.log('Tipo\t\tLocal ID\tSKU\t\t\tEstado');
    console.log('-'.repeat(80));

    for (const mapping of mappings) {
      const type = mapping.localVariantId ? 'Variante' : 'Producto';
      const localId = mapping.localVariantId || mapping.localProductId;
      console.log(`${type}\t\t${localId}\t${mapping.sku}\t${mapping.syncStatus}`);
    }

    console.log('\n✨ Proceso completado exitosamente!');
    console.log('\n📝 Próximos pasos:');
    console.log('1. Verifica los SKUs generados');
    console.log('2. Ejecuta la sincronización con Tiendanube');
    console.log('3. Los productos estarán listos para sincronizar');

  } catch (error) {
    console.error('❌ Error generando SKUs:', error);
    process.exit(1);
  }
}

// Ejecutar script
const storeId = process.argv[2];

if (!storeId) {
  console.error('❌ Debes proporcionar el Store ID de Tiendanube');
  console.error('Uso: npx tsx scripts/generate-skus.ts <STORE_ID>');
  process.exit(1);
}

generateSKUs(storeId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
