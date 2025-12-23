// scripts/check-shipping-settings.js
// Verificar configuración de envíos en la BD

const { db } = require('../lib/db');
const { shippingSettings } = require('../lib/schema');

async function checkShippingSettings() {
  try {
    console.log('🔍 Verificando configuración de envíos...');
    
    const settings = await db.select().from(shippingSettings).limit(1);
    
    if (settings.length === 0) {
      console.log('❌ No hay configuración de envíos en la BD');
      console.log('💡 Debes configurar los datos en el panel de administración');
      return;
    }
    
    const setting = settings[0];
    console.log('✅ Configuración encontrada:');
    console.log(`   - CP del negocio: ${setting.businessZipCode}`);
    console.log(`   - Costo envío local: $${setting.localShippingCost}`);
    console.log(`   - Envío gratis a partir de: $${setting.freeShippingThreshold}`);
    console.log(`   - Tiendanube store ID: ${setting.tiendanubeStoreId}`);
    console.log(`   - Tiendanube habilitado: ${setting.tiendanubeEnabled}`);
    
  } catch (error) {
    console.error('❌ Error al verificar configuración:', error);
  }
}

checkShippingSettings();
