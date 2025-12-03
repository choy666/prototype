const crypto = require('crypto');

// Datos del webhook decodificados
const xSignature = "ts=1764716789,v1=675e89fe605e1cc539471a27161bcceb692587760a31efd46c2f998d1ff4987";
const xRequestId = "9ed9c072-863b-4423-8f74-18c67b00e6ac";
const rawBody = '{"resource":"https://api.mercadolibre.com/merchant_orders/3607377642","topic":"merchant_order"}';
const webhookSecret = "c427050f6853aa330e5be6daed8375f1a1a6b7a606a6afd6a16d2ad6070c8dfd";

// Extraer componentes del x-signature
const parts = xSignature.split(',');
let ts, signature;
for (const part of parts) {
  const [key, value] = part.trim().split('=');
  if (key === 'ts') ts = value;
  if (key === 'v1') signature = value;
}

// Extraer dataId del payload (merchant_order ID)
const parsed = JSON.parse(rawBody);
const resourceMatch = parsed.resource.match(/(\d+)$/);
const dataId = resourceMatch ? resourceMatch[1] : null;

console.log('=== DATOS DEL WEBHOOK ===');
console.log('x-signature:', xSignature);
console.log('x-request-id:', xRequestId);
console.log('rawBody:', rawBody);
console.log('webhookSecret:', webhookSecret);
console.log('ts extraído:', ts);
console.log('v1 extraído:', signature);
console.log('dataId extraído:', dataId);

// Construir string_to_sign según documentación de Mercado Pago
const stringToSign = `id:${dataId};request-id:${xRequestId};ts:${ts}`;
console.log('\n=== STRING TO SIGN ===');
console.log('stringToSign:', stringToSign);

// Calcular HMAC-SHA256
const hmac = crypto.createHmac('sha256', webhookSecret);
hmac.update(stringToSign);
const expectedSignature = hmac.digest('hex');

console.log('\n=== COMPARACIÓN DE FIRMAS ===');
console.log('Firma recibida (v1):', signature);
console.log('Firma calculada:', expectedSignature);
console.log('¿Coinciden?', signature === expectedSignature);

if (signature !== expectedSignature) {
  console.log('\n=== ANÁLISIS DE DIFERENCIAS ===');
  console.log('Longitud recibida:', signature.length);
  console.log('Longitud calculada:', expectedSignature.length);
  
  // Probar con secret normalizado (sin quotes/spaces)
  const normalizedSecret = webhookSecret.replace(/^["']|["']$/g, '').trim();
  console.log('\nSecret normalizado:', normalizedSecret);
  console.log('¿Secret cambió al normalizar?', webhookSecret !== normalizedSecret);
  
  if (webhookSecret !== normalizedSecret) {
    const hmac2 = crypto.createHmac('sha256', normalizedSecret);
    hmac2.update(stringToSign);
    const expectedSignature2 = hmac2.digest('hex');
    console.log('Firma con secret normalizado:', expectedSignature2);
    console.log('¿Coincide con secret normalizado?', signature === expectedSignature2);
  }
  
  // Probar diferentes IDs candidatos
  console.log('\n=== PROBANDO DIFERENTES IDs ===');
  const candidates = [
    dataId,
    parsed.resource, // URL completa
    'merchant_order', // topic
  ];
  
  for (const candidate of candidates) {
    const testString = `id:${candidate};request-id:${xRequestId};ts:${ts}`;
    const hmacTest = crypto.createHmac('sha256', webhookSecret);
    hmacTest.update(testString);
    const testSignature = hmacTest.digest('hex');
    console.log(`ID "${candidate}": ${testSignature} ${testSignature === signature ? '✅ MATCH' : '❌'}`);
  }
}
