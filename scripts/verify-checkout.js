// scripts/verify-checkout.js
/**
 * Script de verificación rápida del flujo de checkout
 * Verifica que todas las correcciones estén implementadas correctamente
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando correcciones del flujo de checkout...\n');

let hasErrors = false;

// Verificaciones a realizar
const checks = [
  {
    name: 'Estructura de directorios - payment-success',
    path: 'app/(protected)/payment-success/page.tsx',
    type: 'file_exists',
    description: 'Verifica que la carpeta payment-success existe (corregida de payment-succes)'
  },
  {
    name: 'Router correcto en payment-success',
    path: 'app/(protected)/payment-success/page.tsx',
    type: 'file_content',
    search: "import { useSearchParams, useRouter } from 'next/navigation'",
    description: 'Verifica que usa el router correcto de Next.js 13+'
  },
  {
    name: 'Webhook route existe',
    path: 'app/api/webhooks/mercado-pago/route.ts',
    type: 'file_exists',
    description: 'Verifica que el endpoint de webhook existe'
  },
  {
    name: 'URL correcta en checkout route',
    path: 'app/api/checkout/route.ts',
    type: 'file_content',
    search: 'payment-success',
    description: 'Verifica que apunta a la URL correcta en back_urls'
  },
  {
    name: 'Variable de entorno correcta en check-env',
    path: 'scripts/check-env.ts',
    type: 'file_content',
    search: '/api/webhooks/mercado-pago',
    description: 'Verifica que la URL del webhook es correcta'
  },
  {
    name: 'Documentación actualizada',
    path: 'scripts/deploy-checklist.md',
    type: 'file_content',
    search: '/api/webhooks/mercado-pago',
    description: 'Verifica que la documentación está actualizada'
  }
];

// Función para verificar si un archivo existe
function checkFileExists(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  return fs.existsSync(fullPath);
}

// Función para verificar contenido en archivo
function checkFileContent(filePath, searchText) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return false;

    const content = fs.readFileSync(fullPath, 'utf8');
    return content.includes(searchText);
  } catch (error) {
    return false;
  }
}

// Ejecutar verificaciones
checks.forEach((check, index) => {
  const number = (index + 1).toString().padStart(2, '0');
  let result = false;

  if (check.type === 'file_exists') {
    result = checkFileExists(check.path);
  } else if (check.type === 'file_content') {
    result = checkFileContent(check.path, check.search);
  }

  if (result) {
    console.log(`✅ ${number}. ${check.name}`);
    console.log(`    📁 ${check.path}`);
    console.log(`    💡 ${check.description}\n`);
  } else {
    console.log(`❌ ${number}. ${check.name}`);
    console.log(`    📁 ${check.path}`);
    console.log(`    💡 ${check.description}`);
    console.log(`    ⚠️  PROBLEMA: Verificación fallida\n`);
    hasErrors = true;
  }
});

// Verificaciones adicionales de estructura
console.log('📂 Verificando estructura de directorios...\n');

const structureChecks = [
  {
    path: 'app/(protected)/payment-failure',
    name: 'Directorio payment-failure'
  },
  {
    path: 'app/(protected)/payment-pending',
    name: 'Directorio payment-pending'
  },
  {
    path: 'app/(protected)/payment-succes',
    name: 'Directorio incorrecto payment-succes (debería estar eliminado)',
    shouldNotExist: true
  }
];

structureChecks.forEach(check => {
  const exists = checkFileExists(check.path);

  if (check.shouldNotExist) {
    if (!exists) {
      console.log(`✅ ${check.name} - Correctamente eliminado`);
    } else {
      console.log(`❌ ${check.name} - AÚN EXISTE (debe ser eliminado)`);
      hasErrors = true;
    }
  } else {
    if (exists) {
      console.log(`✅ ${check.name} - Existe`);
    } else {
      console.log(`❌ ${check.name} - No encontrado`);
      hasErrors = true;
    }
  }
});

console.log('\n' + '='.repeat(60));

if (hasErrors) {
  console.log('❌ VERIFICACIÓN FALLIDA');
  console.log('\n🔧 Acciones requeridas:');
  console.log('1. Revisar los elementos marcados como fallidos');
  console.log('2. Aplicar las correcciones necesarias');
  console.log('3. Ejecutar nuevamente este script');
  console.log('4. Una vez exitoso, proceder con el deploy');

  process.exit(1);
} else {
  console.log('✅ VERIFICACIÓN EXITOSA');
  console.log('\n🎉 Todas las correcciones del flujo de checkout están implementadas');
  console.log('\n📋 Próximos pasos:');
  console.log('1. Actualizar variables de entorno en Vercel');
  console.log('2. Configurar webhook URL en Mercado Pago');
  console.log('3. Realizar testing completo del flujo');
  console.log('4. Monitorear logs post-deploy');

  console.log('\n🔗 URLs importantes:');
  console.log('- Webhook: https://prototype-ten-dun.vercel.app/api/webhooks/mercado-pago');
  console.log('- Success: https://prototype-ten-dun.vercel.app/payment-success');
  console.log('- Failure: https://prototype-ten-dun.vercel.app/payment-failure');
  console.log('- Pending: https://prototype-ten-dun.vercel.app/payment-pending');
}

console.log('\n📄 Para más detalles, revisar: CHECKOUT_AUDIT_REPORT.md');
