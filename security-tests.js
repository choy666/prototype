// Tests de seguridad para el checkout
const axios = require('axios');

const BASE_URL = 'http://localhost:3000'; // Cambiar según el entorno

async function testSQLInjection() {
  console.log('🧪 Probando inyección SQL...');

  const maliciousPayload = {
    items: [{
      id: "1' OR '1'='1",
      name: "Producto Malicioso",
      price: 100,
      discount: 0,
      quantity: 1
    }]
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/checkout`, maliciousPayload);
    console.log('❌ Posible vulnerabilidad SQLi detectada');
  } catch (error) {
    console.log('✅ SQLi test passed - request rejected');
  }
}

async function testXSS() {
  console.log('🧪 Probando XSS...');

  const xssPayload = {
    items: [{
      id: 1,
      name: "<script>alert('XSS')</script>",
      price: 100,
      discount: 0,
      quantity: 1
    }]
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/checkout`, xssPayload);
    console.log('⚠️  XSS payload accepted - revisar sanitización');
  } catch (error) {
    console.log('✅ XSS test passed - payload rejected');
  }
}

async function testPriceManipulation() {
  console.log('🧪 Probando manipulación de precios...');

  const manipulatedPayload = {
    items: [{
      id: 1,
      name: "Producto Normal",
      price: -1000, // Precio negativo
      discount: 200, // Descuento > 100%
      quantity: 1
    }]
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/checkout`, manipulatedPayload);
    console.log('❌ Manipulación de precio permitida - calcular total negativo');
  } catch (error) {
    console.log('✅ Price manipulation test passed');
  }
}

async function testRateLimiting() {
  console.log('🧪 Probando rate limiting...');

  const promises = [];
  for (let i = 0; i < 15; i++) { // Aumentar a 15 para exceder el límite de 10
    promises.push(
      axios.post(`${BASE_URL}/api/checkout`, {
        items: [{ id: 1, name: "Test", price: 100, discount: 0, quantity: 1 }]
      }).catch((error) => {
        if (error.response && error.response.status === 429) {
          return { rateLimited: true };
        }
        return {};
      })
    );
  }

  const results = await Promise.all(promises);
  const rateLimitedCount = results.filter(result => result.rateLimited).length;

  if (rateLimitedCount > 0) {
    console.log(`✅ Rate limiting activo - ${rateLimitedCount} requests bloqueadas`);
  } else {
    console.log('⚠️  No hay rate limiting aparente');
  }
}

async function runSecurityTests() {
  console.log('🚀 Iniciando pruebas de seguridad del checkout...\n');

  await testSQLInjection();
  await testXSS();
  await testPriceManipulation();
  await testRateLimiting();

  console.log('\n✨ Pruebas completadas');
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  runSecurityTests();
}

module.exports = { runSecurityTests, testSQLInjection, testXSS, testPriceManipulation, testRateLimiting };
