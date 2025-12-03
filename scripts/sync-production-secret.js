// Script para sincronizar webhook secret de producción con local
const { execSync } = require('child_process');
const fs = require('fs');

console.log('=== SINCRONIZACIÓN WEBHOOK SECRET PRODUCCIÓN ===\n');

try {
  // 1. Obtener variables de producción de Vercel
  console.log('📥 Descargando variables de producción...');
  try {
    execSync('vercel env pull .env.production', { stdio: 'inherit' });
    console.log('✅ Variables de producción descargadas en .env.production');
  } catch (error) {
    console.log('❌ Error descargando variables de producción');
    console.log('💡 Asegúrate de tener Vercel CLI instalado y autenticado');
    process.exit(1);
  }

  // 2. Leer secrets
  const localEnv = fs.readFileSync('.env.local', 'utf8');
  const prodEnv = fs.readFileSync('.env.production', 'utf8');

  const localSecret = extractSecret(localEnv);
  const prodSecret = extractSecret(prodEnv);

  console.log('\n🔍 COMPARACIÓN DE WEBHOOK SECRETS:');
  console.log('Local (.env.local):', localSecret);
  console.log('Producción (.env.production):', prodSecret);
  console.log('');

  if (localSecret === prodSecret) {
    console.log('✅ Los secrets coinciden - el problema no está aquí');
    console.log('💡 Revisa la configuración en dashboard de MercadoPago');
  } else {
    console.log('❌ Los secrets DIFIEREN - esta es la causa del problema');
    console.log('🔧 ACCIONES RECOMENDADAS:');
    console.log('');
    console.log('Opción 1: Actualizar producción con secret local:');
    console.log(`vercel env add MERCADO_PAGO_WEBHOOK_SECRET production`);
    console.log(`Valor: ${localSecret}`);
    console.log('');
    console.log('Opción 2: Actualizar local con secret de producción:');
    console.log(`Reemplazar en .env.local: ${prodSecret}`);
    console.log('');
    console.log('Opción 3: Verificar dashboard MercadoPago:');
    console.log('1. Ve a MercadoPago > Webhooks');
    console.log('2. Revisa el secret configurado para tu URL de producción');
    console.log('3. Asegúrate que coincida con el que usas en Vercel');
  }

} catch (error) {
  console.log('❌ Error:', error.message);
}

function extractSecret(envContent) {
  const match = envContent.match(/MERCADO_PAGO_WEBHOOK_SECRET\s*=\s*([^\n\r]+)/);
  return match ? match[1].trim().replace(/['"]/g, '') : 'NO ENCONTRADO';
}
