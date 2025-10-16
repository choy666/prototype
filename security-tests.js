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
  for (let i = 0; i < 100; i++) {
    promises.push(
      axios.post(`${BASE_URL}/api/checkout`, {
        items: [{ id: 1, name: "Test", price: 100, discount: 0, quantity: 1 }]
      }).catch(() => ({})) // Ignorar errores
    );
  }

  const start = Date.now();
  await Promise.all(promises);
  const duration = Date.now() - start;

  if (duration < 1000) { // Si se procesaron muy rápido
    console.log('⚠️  No hay rate limiting aparente');
  } else {
    console.log('✅ Rate limiting parece estar activo');
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
