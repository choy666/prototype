#!/usr/bin/env node

/**
 * Script para depurar y obtener el webhook secret real
 * Genera firma válida usando el secret del entorno
 */

const crypto = require('crypto');

// Obtener el webhook secret del entorno - SIN FALLBACK PARA DETECTAR EL ERROR REAL
const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

console.log('=== DEPURACIÓN WEBHOOK SECRET ===\n');

if (!webhookSecret) {
  console.log('❌ ERROR: MERCADO_PAGO_WEBHOOK_SECRET no está configurado');
  console.log('💡 SOLUCIÓN:');
  console.log('1. Verifica variables de entorno en Vercel');
  console.log('2. Descarga con: vercel env pull .env.local');
  console.log('3. O agrega manualmente en .env.local');
  process.exit(1);
}

console.log('✅ Webhook secret encontrado:');
console.log('Longitud:', webhookSecret.length);
console.log('Primeros 4 chars:', webhookSecret.substring(0, 4));
console.log('Últimos 4 chars:', webhookSecret.substring(webhookSecret.length - 4));
console.log('Secret completo (DEBUG):', webhookSecret);
console.log('');

// Generar firma con timestamp actual
const timestamp = Math.floor(Date.now() / 1000);
const requestId = `test-${timestamp}`;
const resourceId = '3607377642';

const stringToSign = `id:${resourceId};request-id:${requestId};ts:${timestamp}`;

console.log('=== GENERANDO FIRMA VÁLIDA ===\n');
console.log('Timestamp:', timestamp);
console.log('Request ID:', requestId);
console.log('String a firmar:', stringToSign);

const hmac = crypto.createHmac('sha256', webhookSecret);
hmac.update(stringToSign);
const signature = hmac.digest('hex');

console.log('Firma HMAC generada:', signature);
console.log('');

// Comando curl completo
console.log('=== COMANDO CURL PARA PRUEBA ===\n');
console.log(`curl -X POST https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago \\`);
console.log(`  -H "x-request-id: ${requestId}" \\`);
console.log(`  -H "x-signature: ts=${timestamp},v1=${signature}" \\`);
console.log(`  -H "content-type: application/json" \\`);
console.log(`  -d '{"resource":"https://api.mercadolibre.com/merchant_orders/${resourceId}","topic":"merchant_order"}'`);

console.log('\n🔍 Para verificar manualmente:');
console.log(`echo -n "${stringToSign}" | openssl dgst -sha256 -hmac "${webhookSecret}"`);
