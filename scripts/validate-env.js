/**
 * Script de validación de variables de entorno
 * Ejecutar: node scripts/validate-env.js
 */

const { validateAllEnv } = require('../lib/utils/env-validation');

function main() {
  console.log('🚀 Validando configuración del entorno...');
  
  const validation = validateAllEnv();
  
  if (validation.isValid) {
    console.log('✅ Configuración válida - Puedes iniciar la aplicación');
    process.exit(0);
  } else {
    console.error('\n❌ Errores encontrados:');
    console.error(validation.errors.join('\n'));
    console.error('\n💡 Por favor, corrige estos problemas antes de iniciar la aplicación.');
    process.exit(1);
  }
}

main();
