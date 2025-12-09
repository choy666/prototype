// Script para verificar configuración de webhook secret
// Ejecutar con: node scripts/debug-webhook-secret.js

const crypto = require('crypto');

function testWebhookSignature() {
  // Obtener el secret de las variables de entorno
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
  
  console.log('🔍 Verificando configuración de webhook secret:');
  console.log('='.repeat(50));
  
  if (!secret) {
    console.log('❌ MERCADO_PAGO_WEBHOOK_SECRET no está configurado');
    return;
  }
  
  console.log('✅ Secret configurado:');
  console.log(`   Longitud: ${secret.length} caracteres`);
  console.log(`   Prefijo: ${secret.substring(0, 8)}...`);
  console.log(`   Sufijo: ...${secret.substring(secret.length - 8)}`);
  console.log(`   Tiene whitespace: ${secret !== secret.trim()}`);
  
  // Simular firma de prueba
  const testPayload = {
    data: { id: '123456789' },
    action: 'payment.updated'
  };
  
  const testBody = JSON.stringify(testPayload);
  const testTs = Date.now().toString();
  const testRequestId = '123456789';
  const testPath = '/api/webhooks/mercadopago';
  
  // Construir string a firmar exactamente como lo hace el código
  const bodyHash = crypto.createHash('sha256').update(testBody).digest('hex');
  const stringToSign = `v1:${testTs}:${testRequestId}:${testPath}:${bodyHash}`;
  
  console.log('\n🔧 Simulación de firma:');
  console.log(`   Body: ${testBody}`);
  console.log(`   Body hash: ${bodyHash}`);
  console.log(`   String a firmar: ${stringToSign}`);
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex');
    
  console.log(`   Firma esperada: ${expectedSignature}`);
  
  console.log('\n📋 Instrucciones para verificar en Mercado Pago:');
  console.log('1. Ve a tu dashboard de Mercado Pago');
  console.log('2. Navega a: Integraciones > Webhooks');
  console.log('3. Copia el "secret" que muestra MP');
  console.log('4. Compara con el valor configurado en Vercel');
  console.log('5. Asegúrate que no haya espacios extra ni saltos de línea');
}

testWebhookSignature();
