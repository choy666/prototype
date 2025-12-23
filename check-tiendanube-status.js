const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { tiendanubeStores, tiendanubeProductMapping, products } = require('./lib/schema');

// Conexión a la base de datos
const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);
const db = drizzle(sql);

async function checkStatus() {
  try {
    console.log('🔍 Verificando estado de Tiendanube...\n');

    // 1. Verificar tiendas conectadas
    const stores = await db.select().from(tiendanubeStores);
    console.log(`📊 Tiendas conectadas: ${stores.length}`);
    
    if (stores.length === 0) {
      console.log('❌ No hay tiendas conectadas. Debes autorizar la aplicación primero.');
      console.log('👉 Ve a: https://technocat2.mitiendanube.com/admin/apps y busca tu aplicación');
      return;
    }

    for (const store of stores) {
      console.log(`\n🏪 Tienda: ${store.storeId}`);
      console.log(`   Status: ${store.status}`);
      console.log(`   Installed: ${store.installedAt}`);
      console.log(`   Last Sync: ${store.lastSyncAt}`);
    }

    // 2. Verificar mapeo de productos
    const mappings = await db.select().from(tiendanubeProductMapping);
    console.log(`\n📦 Productos mapeados: ${mappings.length}`);

    if (mappings.length > 0) {
      console.log('\n📋 Detalle del mapeo:');
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
    const activeProducts = await db.select({ id: products.id, name: products.name, isActive: products.isActive })
      .from(products)
      .where(eq(products.isActive, true));
    
    console.log(`\n🎯 Productos locales activos: ${activeProducts.length}`);

    // 4. Resumen
    console.log('\n✅ Resumen:');
    if (stores.length > 0 && mappings.length > 0) {
      console.log('   La integración está activa y hay productos sincronizados');
      console.log('   Si no ves productos en la tienda, verifica:');
      console.log('   1. Que los productos estén publicados (published: true)');
      console.log('   2. Que tengan stock disponible');
      console.log('   3. Que el precio sea mayor a 0');
    } else if (stores.length > 0) {
      console.log('   La tienda está conectada pero no hay productos sincronizados');
      console.log('   Ejecuta: npm run sync:tiendanube <STORE_ID>');
    } else {
      console.log('   No hay tiendas conectadas. Completa el flujo OAuth primero.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

checkStatus();
