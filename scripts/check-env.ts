// Usar require para compatibilidad con ts-node en modo CommonJS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateAllEnv } = require('../lib/utils/env-validation');

function main() {
  const { isValid, errors } = validateAllEnv();

  console.log('\n🔧 Chequeo de variables de entorno (check:env)');
  console.log('='.repeat(60));

  if (isValid) {
    console.log('✅ Todas las variables de entorno críticas están configuradas correctamente');
    process.exit(0);
  } else {
    console.log('❌ Se encontraron problemas en la configuración de entorno:');
    console.log(errors.join('\n'));
    console.log('\n💡 Revisa tu archivo .env.local y las variables configuradas en Vercel.');
    process.exit(1);
  }
}

main();
