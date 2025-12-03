// Script para depurar transformación de request bytes
const crypto = require('crypto');

console.log('=== DEPURACIÓN AVANZADA DE REQUEST BYTES ===\n');

// Secret confirmado
const webhookSecret = 'c427050f6853aa330e5be6daed8375f1a1a6b7a606a6afd6a16d2ad6070c8dfd';

// Datos extraídos de logs recientes (ejemplo real)
const examples = [
  {
    timestamp: '1764800328',
    requestId: 'c04870df-fe0f-4bf1-8f4d-e840240b2447',
    signature: 'f787636975f30507f1e2cef0289f420d5c704066d37f24b9af75962c45aa40ad',
    resourceId: '36100837344'
  },
  {
    timestamp: '1764800329', 
    requestId: '03146cd6-b3f3-40d8-b1bd-8f7072d7bce2',
    signature: 'cb496d65b2f74981d96a20e64bbee98a3c819a7553787364f8146b164274b3ca',
    resourceId: '36100837344'
  }
];

console.log('🔍 ANALIZANDO EJEMPLOS REALES DE LOGS:\n');

examples.forEach((example, index) => {
  console.log(`--- EJEMPLO ${index + 1} ---`);
  console.log('Timestamp:', example.timestamp);
  console.log('Request ID:', example.requestId);
  console.log('Resource ID:', example.resourceId);
  console.log('Signature recibida:', example.signature);
  
  // Probar diferentes strings para firmar
  const candidates = [
    `id:${example.resourceId};request-id:${example.requestId};ts:${example.timestamp}`,
    `id:136348919088;request-id:${example.requestId};ts:${example.timestamp}`, // Payment ID real
    `id:https://api.mercadolibre.com/merchant_orders/${example.resourceId};request-id:${example.requestId};ts:${example.timestamp}`
  ];
  
  console.log('\n🧪 PROBANDO CANDIDATES:');
  
  candidates.forEach((candidate, i) => {
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(candidate);
    const expectedSignature = hmac.digest('hex');
    
    const match = expectedSignature === example.signature;
    console.log(`${i + 1}. String: ${candidate}`);
    console.log(`   Expected: ${expectedSignature}`);
    console.log(`   Received: ${example.signature}`);
    console.log(`   Match: ${match ? '✅' : '❌'}`);
    console.log('');
  });
  
  console.log('---\n');
});

console.log('🔧 ACCIONES RECOMENDADAS:');
console.log('1. Si ninguna firma coincide, el problema está en:');
console.log('   - Transformación del body por Vercel/proxy');
console.log('   - x-request-id diferente al usado por MercadoPago');
console.log('   - Headers modificados antes del handler');
console.log('');
console.log('2. Para depurar en producción:');
console.log('   - Agregar logs de bytes exactos del request');
console.log('   - Capturar headers raw sin transformación');
console.log('   - Verificar middleware que modifica requests');
console.log('');
console.log('3. Solución posible:');
console.log('   - Desactivar middleware de transformación');
console.log('   - Usar req.text() antes de cualquier parsing');
console.log('   - Verificar configuración de Vercel para webhooks');
