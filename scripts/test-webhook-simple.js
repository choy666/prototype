const crypto = require('crypto');

// Payload del usuario
const rawBody = JSON.stringify({
  action: "payment.updated",
  api_version: "v1",
  data: {"id":"123456"},
  date_created: "2021-11-01T02:02:02Z",
  id: "123456",
  live_mode: false,
  type: "payment",
  user_id: 517448794
});

console.log('=== TESTING WEBHOOK SIMULATOR ===');
console.log('Payload:', rawBody);

// Parsear para extraer data ID
const parsed = JSON.parse(rawBody);
const dataId = parsed?.data?.id ?? parsed?.id;

console.log('Data ID extraído:', dataId);
console.log('¿Es ID 123456?', dataId === '123456' || dataId === 123456);

// Simular la lógica del verificador
if (dataId === '123456' || dataId === 123456) {
  console.log('✅ SIMULATOR MODE: Webhook debería ser permitido sin firma');
} else {
  console.log('❌ No se detectó modo simulador');
}
