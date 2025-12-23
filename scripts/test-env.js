// Script simple para probar carga de variables de entorno
console.log('=== DIAGNÓSTICO DE VARIABLES DE ENTORNO ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Definida' : '❌ No definida');
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);

if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL (primeros 50 chars):', process.env.DATABASE_URL.substring(0, 50) + '...');
}

console.log('\n=== VARIABLES TIENDANUBE ===');
console.log('TIENDANUBE_APP_ID:', process.env.TIENDANUBE_APP_ID);
console.log('TIENDANUBE_CLIENT_SECRET:', process.env.TIENDANUBE_CLIENT_SECRET ? '✅ Definida' : '❌ No definida');
