/**
 * Configuración centralizada para integraciones con Mercado Libre y Mercado Pago
 * Siguiendo las buenas prácticas de sus APIs oficiales
 */

// URLs base de las APIs (oficiales, no cambiar por documentación ML/MP)
export const API_ENDPOINTS = {
  mercadolibre: {
    base: 'https://api.mercadolibre.com',
    oauth: '/oauth/token',
    sites: '/sites',
    categories: '/sites/{site_id}/categories',
    users: '/users',
    items: '/items',
    shipments: '/shipments',
    shipping_options: '/shipping_options',
    questions: '/questions',
    orders: '/orders',
  },
  mercadopago: {
    base: 'https://api.mercadopago.com',
    oauth: '/oauth/token',
    preferences: '/checkout/preferences',
    payments: '/v1/payments',
    notifications: '/ipn/notifications',
    customers: '/v1/customers',
  },
} as const;

// Configuración por país (site_id de Mercado Libre)
export const SITE_CONFIG = {
  MLA: {
    country: 'Argentina',
    currency: 'ARS',
    locale: 'es-AR',
    defaultShippingModes: ['me2', 'me1'],
    maxInstallments: 12,
    freeShippingAmount: 5000,
  },
  MLB: {
    country: 'Brasil',
    currency: 'BRL',
    locale: 'pt-BR',
    defaultShippingModes: ['me2'],
    maxInstallments: 12,
    freeShippingAmount: 0,
  },
  MLC: {
    country: 'Chile',
    currency: 'CLP',
    locale: 'es-CL',
    defaultShippingModes: ['me2'],
    maxInstallments: 6,
    freeShippingAmount: 10000,
  },
  MLM: {
    country: 'México',
    currency: 'MXN',
    locale: 'es-MX',
    defaultShippingModes: ['me2'],
    maxInstallments: 12,
    freeShippingAmount: 500,
  },
} as const;

const getEnvValue = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return null;
};

// Configuración dinámica basada en variables de entorno
export const getMercadoLibreConfig = () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

  const siteId =
    getEnvValue('MERCADO_LIBRE_SITE_ID', 'MERCADOLIBRE_SITE_ID', 'ML_SITE_ID') || 'MLA';
  const sellerId = getEnvValue('MERCADO_LIBRE_SELLER_ID', 'MERCADOLIBRE_SELLER_ID', 'ML_SELLER_ID');
  const appId = getEnvValue('MERCADO_LIBRE_CLIENT_ID', 'MERCADOLIBRE_CLIENT_ID', 'ML_APP_ID');
  const clientSecret = getEnvValue(
    'MERCADO_LIBRE_CLIENT_SECRET',
    'MERCADOLIBRE_CLIENT_SECRET',
    'ML_CLIENT_SECRET'
  );
  const redirectUri =
    getEnvValue('MERCADO_LIBRE_REDIRECT_URI', 'MERCADOLIBRE_REDIRECT_URI', 'ML_REDIRECT_URI') ||
    `${appUrl}/api/auth/mercadolibre/callback`;

  const scopesFromEnv =
    getEnvValue('MERCADO_LIBRE_SCOPES', 'MERCADOLIBRE_SCOPES') || process.env.ML_OAUTH_SCOPES;

  const oauthScopes = scopesFromEnv
    ? scopesFromEnv
        .split(/[,\s]+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
    : [
        'read_orders',
        'write_products',
        'read_products',
        'offline_access',
        'read_inventory',
        'write_inventory',
        'read_shipping',
        'write_shipping',
        'read_user_email',
        'read_user_profile',
      ];

  return {
    siteId,
    sellerId,
    appId,
    clientSecret,
    redirectUri,
    baseUrl: API_ENDPOINTS.mercadolibre.base,
    authUrl: process.env.MERCADO_LIBRE_AUTH_URL || 'https://auth.mercadolibre.com.ar/authorization',
    webhookUrl: process.env.MERCADO_LIBRE_WEBHOOK_URL || process.env.ML_WEBHOOK_URL || null,
    notificationTopics: process.env.ML_WEBHOOK_TOPICS?.split(',') || [
      'payments',
      'orders',
      'shipments',
      'questions',
      'items',
    ],
    scopes: ['read', 'write', 'offline_access'],
    oauthScopes,
    apiBaseUrl: API_ENDPOINTS.mercadolibre.base,
    timeout: parseInt(process.env.ML_API_TIMEOUT || '30000'),
    retryAttempts: parseInt(process.env.ML_API_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.ML_API_RETRY_DELAY || '1000'),
  };
};

export const getMercadoPagoConfig = () => ({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
  publicKey: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY,
  webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
  webhookUrl: process.env.MERCADO_PAGO_WEBHOOK_URL,
  successUrl: process.env.MERCADO_PAGO_SUCCESS_URL,
  failureUrl: process.env.MERCADO_PAGO_FAILURE_URL,
  pendingUrl: process.env.MERCADO_PAGO_PENDING_URL,
  notificationUrl: process.env.MERCADO_PAGO_NOTIFICATION_URL,
  statementDescriptor: process.env.MERCADO_PAGO_STATEMENT_DESCRIPTOR,
  apiVersion: 'v1',
  timeout: parseInt(process.env.MP_API_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.MP_API_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.MP_API_RETRY_DELAY || '1000'),
});

// Configuración de paginación y límites
export const PAGINATION = {
  defaultLimit: 50,
  maxLimit: 100,
  defaultOffset: 0,
} as const;

// Configuración de caché
export const CACHE_CONFIG = {
  categories: {
    ttl: 3600000, // 1 hora en ms
    maxSize: 1000,
  },
  products: {
    ttl: 300000, // 5 minutos en ms
    maxSize: 500,
  },
  shippingModes: {
    ttl: 1800000, // 30 minutos en ms
    maxSize: 100,
  },
} as const;

// Configuración de envíos ME2
export const getME2Config = () => ({
  defaultDimensions: {
    height: 10,
    width: 10,
    length: 10,
    weight: 0.5,
  },
  minDimensions: {
    height: 1,
    width: 1,
    length: 1,
    weight: 0.1,
  },
  maxDimensions: {
    height: 100,
    width: 100,
    length: 100,
    weight: 25,
  },
  packagingCost: 50, // Costo base de empaque
  handlingCost: 30, // Costo base de manipulación
});

// Configuración de webhooks
export const WEBHOOK_CONFIG = {
  maxRetries: parseInt(process.env.ML_WEBHOOK_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.ML_WEBHOOK_RETRY_DELAY || '5000'),
  timeout: parseInt(process.env.ML_WEBHOOK_TIMEOUT || '30000'),
  signatureHeader: process.env.ML_WEBHOOK_SIGNATURE_HEADER || 'x-signature',
  requestIdHeader: process.env.ML_WEBHOOK_REQUEST_ID_HEADER || 'x-request-id',
  replayCacheTtlMs: parseInt(process.env.ML_WEBHOOK_REPLAY_TTL_MS || `${5 * 60 * 1000}`),
} as const;

// Validación de configuración requerida
export const validateConfig = () => {
  const mlConfig = getMercadoLibreConfig();
  const mpConfig = getMercadoPagoConfig();
  const errors: string[] = [];

  // Validar Mercado Libre
  if (!mlConfig.sellerId) errors.push('MERCADO_LIBRE_SELLER_ID/ML_SELLER_ID es requerido');
  if (!mlConfig.appId) errors.push('MERCADO_LIBRE_CLIENT_ID/ML_APP_ID es requerido');
  if (!mlConfig.clientSecret)
    errors.push('MERCADO_LIBRE_CLIENT_SECRET/ML_CLIENT_SECRET es requerido');

  // Validar Mercado Pago
  if (!mpConfig.accessToken) errors.push('MERCADO_PAGO_ACCESS_TOKEN es requerido');
  if (!mpConfig.publicKey) errors.push('NEXT_PUBLIC_MP_PUBLIC_KEY es requerido');
  if (!mpConfig.webhookSecret) errors.push('MERCADO_PAGO_WEBHOOK_SECRET es requerido');

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Helper para obtener URL completa de API
export const getApiUrl = (
  service: 'mercadolibre' | 'mercadopago',
  endpoint: string,
  params?: Record<string, string>
) => {
  const baseUrl = API_ENDPOINTS[service].base;
  let url = baseUrl + endpoint;

  // Crear copia de params para evitar mutar el objeto original
  const paramsCopy = params ? { ...params } : {};

  // Reemplazar parámetros en la URL (ej: {site_id})
  url = url.replace(/\{([^}]+)\}/g, (match, key) => {
    if (paramsCopy[key]) {
      const value = paramsCopy[key];
      delete paramsCopy[key]; // Remover para no incluir en query string
      return value;
    }
    throw new Error(`Missing required URL parameter: ${key}`);
  });

  if (Object.keys(paramsCopy).length > 0) {
    const searchParams = new URLSearchParams(paramsCopy);
    url += '?' + searchParams.toString();
  }

  return url;
};

// Helper para obtener configuración de site actual
export const getCurrentSiteConfig = () => {
  const mlConfig = getMercadoLibreConfig();
  return SITE_CONFIG[mlConfig.siteId as keyof typeof SITE_CONFIG] || SITE_CONFIG.MLA;
};
