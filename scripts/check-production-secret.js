// Script para verificar si el webhook secret coincide con producción
const crypto = require('crypto');

console.log('=== VERIFICACIÓN WEBHOOK SECRET PRODUCCIÓN ===\n');

// Webhook secret local encontrado en .env.local
const localSecret = 'c427050f6853aa330e5be6daed8375f1a1a6b7a606a6afd6a16d2ad6070c8dfd';

// Timestamp actual (3 de diciembre 2025)
const timestamp = Math.floor(Date.now() / 1000);
const requestId = `test-${timestamp}`;
const resourceId = '3607377642';

console.log('🔍 DATOS ACTUALES:');
console.log('Fecha actual: 3 de diciembre 2025');
console.log('Timestamp generado:', timestamp);
console.log('Request ID:', requestId);
console.log('');

console.log('🔑 WEBHOOK SECRETS:');
console.log('Local (.env.local):', localSecret);
console.log('Longitud local:', localSecret.length);
console.log('');

// Generar firma con timestamp actual y secret local
const stringToSign = `id:${resourceId};request-id:${requestId};ts:${timestamp}`;
const hmac = crypto.createHmac('sha256', localSecret);
hmac.update(stringToSign);
const localSignature = hmac.digest('hex');

console.log('🔐 FIRMA GENERADA CON DATOS ACTUALES:');
console.log('String a firmar:', stringToSign);
console.log('Firma HMAC:', localSignature);
console.log('');

// Comando curl con timestamp actual
console.log('=== COMANDO CURL CON FECHA ACTUAL (2025) ===\n');
console.log(`curl -X POST https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago \\`);
console.log(`  -H "x-request-id: ${requestId}" \\`);
console.log(`  -H "x-signature: ts=${timestamp},v1=${localSignature}" \\`);
console.log(`  -H "content-type: application/json" \\`);
console.log(`  -d '{"resource":"https://api.mercadolibre.com/merchant_orders/${resourceId}","topic":"merchant_order"}'`);

console.log('\n⚠️ SI FALLA, VERIFICAR:');
console.log('1. Que el webhook secret en Vercel producción coincida con el local');
console.log('2. Configuración de la aplicación MercadoPago (sandbox vs producción)');
console.log('3. Si MercadoPago tiene restricciones de timestamp para tu cuenta');

console.log('\n🔍 Para verificar en Vercel:');
console.log('vercel env ls');
console.log('vercel env pull .env.production');
