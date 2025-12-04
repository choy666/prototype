/**
 * Validación de variables de entorno críticas
 * Este archivo ayuda a detectar configuraciones faltantes al iniciar la aplicación
 */

interface EnvConfig {
  required: string[];
  optional: string[];
  development?: string[];
  production?: string[];
}

const configs: Record<string, EnvConfig> = {
  // Base de datos
  database: {
    required: ['DATABASE_URL'],
    optional: ['DATABASE_URL_UNPOOLED', 'NEON_PROJECT_ID'],
  },
  
  // NextAuth
  auth: {
    required: ['NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'JWT_SECRET'],
    optional: ['NEXTAUTH_COOKIE_DOMAIN', 'NEXTAUTH_DEBUG'],
  },
  
  // Mercado Libre
  mercadolibre: {
    required: ['MERCADOLIBRE_CLIENT_ID', 'MERCADOLIBRE_CLIENT_SECRET'],
    optional: ['MERCADOLIBRE_REDIRECT_URI', 'MERCADOLIBRE_WEBHOOK_URL'],
  },
  
  // Mercado Pago
  mercadopago: {
    required: ['MERCADO_PAGO_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET', 'NEXT_PUBLIC_MP_PUBLIC_KEY'],
    optional: ['MERCADO_PAGO_WEBHOOK_URL'],
    development: ['MERCADO_PAGO_SUCCESS_URL', 'MERCADO_PAGO_FAILURE_URL', 'MERCADO_PAGO_PENDING_URL'],
  },
  
  // URLs de aplicación
  urls: {
    required: ['NEXT_PUBLIC_APP_URL'],
    optional: ['APP_URL'],
  },
};

/**
 * Valida un grupo específico de variables de entorno
 */
export function validateEnvGroup(groupName: string): { isValid: boolean; errors: string[] } {
  const config = configs[groupName];
  if (!config) {
    return { isValid: false, errors: [`Grupo de configuración '${groupName}' no encontrado`] };
  }

  const errors: string[] = [];
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Validar variables requeridas
  for (const varName of config.required) {
    if (!process.env[varName]) {
      errors.push(`❌ Variable requerida faltante: ${varName}`);
    }
  }

  // Validar variables específicas del entorno
  const envSpecificVars = config[nodeEnv as keyof typeof config] as string[] | undefined;
  if (envSpecificVars) {
    for (const varName of envSpecificVars) {
      if (!process.env[varName]) {
        errors.push(`⚠️ Variable para ${nodeEnv} faltante: ${varName}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida todas las variables de entorno críticas
 */
export function validateAllEnv(): { isValid: boolean; errors: string[] } {
  const allErrors: string[] = [];

  for (const groupName of Object.keys(configs)) {
    const validation = validateEnvGroup(groupName);
    if (!validation.isValid) {
      allErrors.push(`\n🔍 Grupo: ${groupName}`);
      allErrors.push(...validation.errors);
    }
  }

  // Validaciones adicionales específicas
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Verificar que las URLs coincidan con el entorno
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const nextauthUrl = process.env.NEXTAUTH_URL;
  
  if (nodeEnv === 'development') {
    if (appUrl && !appUrl.includes('localhost')) {
      allErrors.push('⚠️ NEXT_PUBLIC_APP_URL debería ser localhost en desarrollo');
    }
    if (nextauthUrl && !nextauthUrl.includes('localhost')) {
      allErrors.push('⚠️ NEXTAUTH_URL debería ser localhost en desarrollo');
    }
  } else if (nodeEnv === 'production') {
    if (appUrl && appUrl.includes('localhost')) {
      allErrors.push('⚠️ NEXT_PUBLIC_APP_URL no debería ser localhost en producción');
    }
    if (nextauthUrl && nextauthUrl.includes('localhost')) {
      allErrors.push('⚠️ NEXTAUTH_URL no debería ser localhost en producción');
    }
  }

  // Validar tokens de Mercado Pago
  const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (mpAccessToken) {
    if (nodeEnv === 'development' && !mpAccessToken.startsWith('TEST-')) {
      allErrors.push('⚠️ MERCADO_PAGO_ACCESS_TOKEN debería empezar con TEST- en desarrollo');
    } else if (nodeEnv === 'production' && mpAccessToken.startsWith('TEST-')) {
      allErrors.push('⚠️ MERCADO_PAGO_ACCESS_TOKEN no debería empezar con TEST- en producción');
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Imprime reporte de validación de variables de entorno
 */
export function printEnvValidation(): void {
  const validation = validateAllEnv();
  
  console.log('\n🔧 Validación de Variables de Entorno');
  console.log('='.repeat(50));
  
  if (validation.isValid) {
    console.log('✅ Todas las variables de entorno están configuradas correctamente');
  } else {
    console.log('❌ Se encontraron problemas en la configuración:');
    console.log(validation.errors.join('\n'));
    console.log('\n💡 Por favor, corrige estos problemas antes de continuar.');
  }
  
  console.log('='.repeat(50));
}

/**
 * Validación para ejecutar al inicio de la aplicación
 */
export function validateEnvOnStartup(): void {
  // Solo mostrar errores detallados en desarrollo
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  if (nodeEnv === 'development') {
    printEnvValidation();
  } else {
    // En producción, solo fallar si hay variables requeridas faltantes
    const validation = validateAllEnv();
    if (!validation.isValid) {
      console.error('❌ Configuración de entorno inválida en producción');
      process.exit(1);
    }
  }
}
