// Script para probar webhook debugging localmente
// Ejecutar con: node test-webhook-debug.js

const crypto = require('crypto');

function simulateWebhookSignature(dataId, requestId, timestamp, secret) {
  const template = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  console.log('🔧 Template generado:', template);
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(template)
    .digest('hex');
    
  console.log('🔐 Firma generada:', signature);
  return signature;
}

// Simular datos de un webhook real
const testData = {
  dataId: '136428334630',
  requestId: 'e31a3f44-28f0-44c9-96dd-4a77d1dad27d',
  timestamp: Math.floor(Date.now() / 1000),
  secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'test-secret-key'
};

console.log('📋 Datos de prueba:', testData);
console.log('');

const signature = simulateWebhookSignature(
  testData.dataId,
  testData.requestId,
  testData.timestamp,
  testData.secret
);

console.log('');
console.log('📤 Header x-signature generado:');
console.log(`ts=${testData.timestamp},v1=${signature}`);
console.log('');
console.log('✅ Usa este header para probar tu endpoint webhook');
