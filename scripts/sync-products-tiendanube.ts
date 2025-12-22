#!/usr/bin/env node

/**
 * Script para sincronizar productos con Tiendanube
 * Crea/actualiza productos en Tiendanube y genera el mapeo de SKUs
 */

import { db } from '../lib/db';
import { products, productVariants, tiendanubeStores, tiendanubeProductMapping } from '../lib/schema';
import { eq } from 'drizzle-orm';
import { createTiendanubeClient } from '../lib/clients/tiendanube';
import { decryptString } from '../lib/utils/encryption';

interface TiendanubeProduct {
  id: string | number;
  sku: string;
  name: string;
  price: string;
  stock: number;
  published: boolean;
}

async function syncProductsToTiendanube(storeId: string) {
  console.log(`🚀 Sincronizando productos para tienda ${storeId}...`);

  try {
    // 1. Obtener cliente de Tiendanube
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, storeId),
    });

    if (!store) {
      throw new Error('Tienda no encontrada');
    }

    const client = createTiendanubeClient({
      storeId,
      accessToken: decryptString(store.accessTokenEncrypted)
    });

    // 2. Obtener productos locales activos con sus SKUs del mapping
    const localProducts = await db
      .select({
        id: products.id,
        sku: tiendanubeProductMapping.sku,
        name: products.name,
        description: products.description,
        price: products.price,
        stock: products.stock,
        image: products.image,
        isActive: products.isActive,
      })
      .from(products)
      .innerJoin(tiendanubeProductMapping, eq(products.id, tiendanubeProductMapping.localProductId))
      .where(eq(products.isActive, true));

    console.log(`📦 Encontrados ${localProducts.length} productos locales para sincronizar`);

    const tnClient = createTiendanubeClient({
      storeId,
      accessToken: decryptString(store.accessTokenEncrypted)
    });

    // 3. Obtener productos existentes en Tiendanube
    const existingProducts = await tnClient.get('/products') as TiendanubeProduct[];
    const existingSkus = new Map(existingProducts.map(p => [p.sku, p]));

    console.log(`📋 Existen ${existingProducts.length} productos en Tiendanube`);

    // 4. Sincronizar cada producto
    for (const product of localProducts) {
      if (!product.sku) {
        console.warn(`⚠️  Producto ${product.id} no tiene SKU, omitiendo`);
        continue;
      }

      const existing = existingSkus.get(product.sku);
      let tnProductId: string | number;

      try {
        if (existing) {
          // Actualizar producto existente
          await tnClient.put(`/products/${existing.id}`, {
            name: product.name,
            description: product.description || '',
            price: product.price.toString(),
            stock: product.stock,
            published: true,
          });
          tnProductId = existing.id;
          console.log(`✅ Actualizado: ${product.sku} -> ID TN: ${existing.id}`);
        } else {
          // Crear nuevo producto
          const newProduct = await tnClient.post('/products', {
            sku: product.sku,
            name: product.name,
            description: product.description || '',
            price: product.price.toString(),
            stock: product.stock,
            published: true,
            images: product.image ? [{ src: product.image }] : [],
          }) as TiendanubeProduct;
          tnProductId = newProduct.id;
          console.log(`✅ Creado: ${product.sku} -> ID TN: ${newProduct.id}`);
        }

        // 5. Actualizar mapeo
        await db.insert(tiendanubeProductMapping)
          .values({
            storeId,
            sku: product.sku,
            tiendanubeProductId: tnProductId.toString(),
            localProductId: product.id,
            localVariantId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [tiendanubeProductMapping.storeId, tiendanubeProductMapping.sku],
            set: {
              tiendanubeProductId: tnProductId.toString(),
              updatedAt: new Date(),
            },
          });

      } catch (error) {
        console.error(`❌ Error sincronizando ${product.sku}:`, error);
      }
    }

    // 6. Sincronizar variantes si existen
    const variants = await db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        sku: tiendanubeProductMapping.sku,
        name: productVariants.name,
        price: productVariants.price,
        stock: productVariants.stock,
        images: productVariants.images,
      })
      .from(productVariants)
      .innerJoin(tiendanubeProductMapping, eq(productVariants.id, tiendanubeProductMapping.localVariantId))
      .where(eq(productVariants.isActive, true));

    if (variants.length > 0) {
      console.log(`\n🔄 Sincronizando ${variants.length} variantes...`);
      
      for (const variant of variants) {
        if (!variant.sku) {
          console.warn(`⚠️  Variante ${variant.id} no tiene SKU, omitiendo`);
          continue;
        }

        const existing = existingSkus.get(variant.sku);
        let tnVariantId: string | number;

        try {
          if (existing) {
            await tnClient.put(`/products/${existing.id}`, {
              name: variant.name,
              price: variant.price?.toString() || '0',
              stock: variant.stock,
              published: true,
            });
            tnVariantId = existing.id;
            console.log(`✅ Variante actualizada: ${variant.sku}`);
          } else {
            const newVariant = await tnClient.post('/products', {
              sku: variant.sku,
              name: variant.name,
              price: variant.price?.toString() || '0',
              stock: variant.stock,
              published: true,
              images: variant.images && Array.isArray(variant.images) ? variant.images.map((img: any) => ({ src: img })) : [],
            }) as TiendanubeProduct;
            tnVariantId = newVariant.id;
            console.log(`✅ Variante creada: ${variant.sku}`);
          }

          // Actualizar mapeo de variante
          await db.insert(tiendanubeProductMapping)
            .values({
              storeId,
              sku: variant.sku,
              tiendanubeProductId: tnVariantId.toString(),
              localProductId: variant.productId,
              localVariantId: variant.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [tiendanubeProductMapping.storeId, tiendanubeProductMapping.sku],
              set: {
                tiendanubeProductId: tnVariantId.toString(),
                updatedAt: new Date(),
              },
            });

        } catch (error) {
          console.error(`❌ Error sincronizando variante ${variant.sku}:`, error);
        }
      }
    }

    console.log('\n✨ Sincronización completada!');
    
    // 7. Generar reporte
    const mappings = await db.query.tiendanubeProductMapping.findMany({
      where: eq(tiendanubeProductMapping.storeId, storeId),
    });

    console.log(`\n📊 Reporte de Mapeo:`);
    console.log('SKU\t\t\tLocal ID\tTN ID\t\tTipo');
    console.log('-'.repeat(80));
    
    for (const mapping of mappings) {
      const type = mapping.localVariantId ? 'Variante' : 'Producto';
      console.log(`${mapping.sku}\t${mapping.localProductId}\t\t${mapping.tiendanubeProductId}\t\t${type}`);
    }

  } catch (error) {
    console.error('❌ Error en sincronización:', error);
    process.exit(1);
  }
}

// Obtener storeId de los argumentos
const storeId = process.argv[2];

if (!storeId) {
  console.error('❌ Debes proporcionar el Store ID de Tiendanube');
  console.error('Uso: npx tsx scripts/sync-products-tiendanube.ts <STORE_ID>');
  process.exit(1);
}

// Ejecutar sincronización
syncProductsToTiendanube(storeId)
  .then(() => {
    console.log('\n🎉 ¡Todos los productos sincronizados!');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
