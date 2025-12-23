#!/usr/bin/env node

import { db } from '../lib/db';
import { tiendanubeStores, tiendanubeProductMapping, products } from '../lib/schema';
import { eq } from 'drizzle-orm';

async function checkStatus() {
  try {
    console.log('🔍 Verificando estado de Tiendanube...\n');

    // 1. Verificar tiendas conectadas
    const stores = await db.select().from(tiendanubeStores);
    console.log(`📊 Tiendas conectadas: ${stores.length}`);
    
    if (stores.length === 0) {
      console.log('❌ No hay tiendas conectadas. Debes autorizar la aplicación primero.');
      console.log('\n👉 Pasos para conectar:');
      console.log('1. Ve a: https://www.tiendanube.com/apps/24333/instalar');
      console.log('2. Inicia sesión con tu cuenta de technocat2.mitiendanube.com');
      console.log('3. Autoriza la aplicación');
      console.log('4. La tienda aparecerá automáticamente en la BD');
      return;
    }

    const storeId = stores[0].storeId;
    
    for (const store of stores) {
      console.log(`\n🏪 Tienda: ${store.storeId}`);
      console.log(`   Status: ${store.status}`);
      console.log(`   Installed: ${store.installedAt}`);
      console.log(`   Last Sync: ${store.lastSyncAt}`);
    }

    // 2. Verificar mapeo de productos
    const mappings = await db.select().from(tiendanubeProductMapping).where(eq(tiendanubeProductMapping.storeId, storeId));
    console.log(`\n📦 Productos mapeados para ${storeId}: ${mappings.length}`);

    if (mappings.length > 0) {
      console.log('\n📋 Primeros 10 productos mapeados:');
      console.log('SKU\t\t\tLocal ID\tTN ID\t\tTipo');
      console.log('-'.repeat(80));
      
      for (const mapping of mappings.slice(0, 10)) {
        const type = mapping.localVariantId ? 'Variante' : 'Producto';
        console.log(`${mapping.sku}\t${mapping.localProductId}\t\t${mapping.tiendanubeProductId}\t\t${type}`);
      }
      
      if (mappings.length > 10) {
        console.log(`... y ${mappings.length - 10} más`);
      }
    }

    // 3. Verificar productos locales activos
    const activeProducts = await db.select({ 
      id: products.id, 
      name: products.name, 
      isActive: products.isActive,
      stock: products.stock,
      price: products.price
    })
      .from(products)
      .where(eq(products.isActive, true));
    
    console.log(`\n🎯 Productos locales activos: ${activeProducts.length}`);

    // 4. Verificar si hay SKUs generados
    const productsWithoutSku = await db.select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.isActive, true));
    
    console.log(`\n📝 Productos que necesitan SKU: ${productsWithoutSku.length}`);

    // 5. Resumen
    console.log('\n✅ Resumen:');
    if (stores.length > 0 && mappings.length > 0) {
      console.log('   La integración está activa y hay productos sincronizados');
      console.log('   Si no ves productos en la tienda, verifica en Tiendanube:');
      console.log('   1. Que los productos estén publicados (visibility: published)');
      console.log('   2. Que tengan stock disponible');
      console.log('   3. Que el precio sea mayor a 0');
      console.log('\n   Para actualizar productos existentes:');
      console.log(`   npm run sync:tiendanube ${storeId}`);
    } else if (stores.length > 0) {
      console.log('   ✅ La tienda está conectada');
      console.log('   ❌ Pero no hay productos sincronizados');
      console.log('\n   Para sincronizar productos por primera vez:');
      console.log('   1. Primero genera SKUs para los productos:');
      console.log('      npm run generate:skus');
      console.log(`   2. Luego sincroniza con Tiendanube:`);
      console.log(`      npm run sync:tiendanube ${storeId}`);
    } else {
      console.log('   ❌ No hay tiendas conectadas');
      console.log('   Completa el flujo OAuth primero');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkStatus();
