#!/usr/bin/env tsx

import { checkDatabaseConnection, checkCriticalTables } from '../lib/db';

async function main() {
  console.log('🔍 Verificando salud de la base de datos...\n');

  // Verificar conexión
  console.log('1. Verificando conexión...');
  const connectionResult = await checkDatabaseConnection();
  console.log(connectionResult.message);
  if (!connectionResult.success) {
    console.error('❌ Error de conexión:', connectionResult.error);
    process.exit(1);
  }

  // Verificar tablas críticas
  console.log('\n2. Verificando tablas críticas...');
  const tablesResult = await checkCriticalTables();
  if (tablesResult.success && tablesResult.tables) {
    console.log('✅ Verificación de tablas completada');
    for (const [table, info] of Object.entries(tablesResult.tables)) {
      const tableInfo = info as { exists: boolean; count?: number; error?: string };
      if (tableInfo.exists) {
        console.log(`   📊 ${table}: ${tableInfo.count} registros`);
      } else {
        console.error(`   ❌ ${table}: No existe - ${tableInfo.error}`);
      }
    }
  } else {
    console.error('❌ Error al verificar tablas:', tablesResult.error);
    process.exit(1);
  }

  console.log('\n✅ Verificación completada exitosamente');
}

main().catch((error) => {
  console.error('❌ Error inesperado:', error);
  process.exit(1);
});
