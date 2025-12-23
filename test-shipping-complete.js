// Script para probar todas las integraciones de envío
const fetch = require('node-fetch');

async function testShippingIntegration() {
  console.log('🚀 Iniciando prueba completa de integración de envíos...\n');

  try {
    // Test 1: Envío local
    console.log('📍 Test 1: Envío local (CP 4700)');
    const localResponse = await fetch('http://localhost:3000/api/shipping/unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerZip: '4700',
        items: [{
          id: '51',
          quantity: 1,
          price: 22750,
          weight: 1000,
          dimensions: { length: 40, width: 30, height: 20 }
        }],
        subtotal: 22750
      })
    });

    const localData = await localResponse.json();
    console.log('✅ Opciones locales:', localData.length);
    localData.forEach(o => {
      console.log(`   - ${o.name} (${o.type}): $${o.cost}`);
    });

    // Test 2: Envío remoto
    console.log('\n📍 Test 2: Envío remoto (CP 5500)');
    const remoteResponse = await fetch('http://localhost:3000/api/shipping/unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerZip: '5500',
        items: [{
          id: '51',
          quantity: 1,
          price: 22750,
          weight: 1000,
          dimensions: { length: 40, width: 30, height: 20 }
        }],
        subtotal: 22750
      })
    });

    const remoteData = await remoteResponse.json();
    console.log('✅ Opciones remotas:', remoteData.length);
    remoteData.forEach(o => {
      console.log(`   - ${o.name} (${o.type} - ${o.carrier}): $${o.cost} - ${o.estimated}`);
    });

    // Test 3: Verificar carriers Tiendanube
    console.log('\n📍 Test 3: Verificando carriers Tiendanube');
    const carriersResponse = await fetch('http://localhost:3000/api/debug/tiendanube-carriers');
    const carriersData = await carriersResponse.json();
    
    if (carriersData.error) {
      console.log('❌ Error carriers:', carriersData.error);
    } else {
      console.log('✅ Carriers encontrados:', carriersData.count);
      carriersData.carriers.forEach(c => {
        console.log(`   - ${c.name} (${c.code}) - ${c.enabled ? 'Activo' : 'Inactivo'}`);
      });
    }

    // Resumen
    console.log('\n📊 Resumen de la prueba:');
    console.log(`   - Envío local: ${localData.length > 0 ? '✅ Funciona' : '❌ Falló'}`);
    console.log(`   - Envío remoto: ${remoteData.length > 0 ? '✅ Funciona' : '❌ Falló'}`);
    console.log(`   - Tiene Tiendanube: ${remoteData.some(o => o.type === 'tiendanube') ? '✅ Sí' : '❌ No'}`);
    console.log(`   - Tiene ME2: ${remoteData.some(o => o.type === 'me2') ? '✅ Sí' : '❌ No'}`);
    console.log(`   - Tiene Local: ${remoteData.some(o => o.type === 'local') ? '✅ Sí' : '❌ No'}`);

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
}

testShippingIntegration();
