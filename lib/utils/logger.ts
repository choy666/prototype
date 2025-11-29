import { z } from 'zod';

// Esquema para validar configuración de logging
const loggerConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  enableConsole: z.boolean().default(true),
  sanitizeSensitiveData: z.boolean().default(false), // TEMPORAL: Desactivado para debugging de webhook
  development: z.boolean().default(false),
});

// Tipos de datos sensibles a sanitizar
const SENSITIVE_KEYS = [
  'password', 'token', 'secret', 'key', 'signature', 'hmac',
  'price', 'discount', 'stock', 'id', 'paymentId', 'mercadoPagoId',
  'ip', 'userAgent', 'user-agent', 'x-forwarded-for', 'x-real-ip',
  'email', 'phone', 'address', 'creditCard', 'cvv', 'expiry'
];

// Función para sanitizar objetos recursivamente
function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return '[REDACTED]';
  if (typeof obj === 'number') return '[REDACTED]';
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      // No sanitizar errores de base de datos para diagnóstico
      if (lowerKey.includes('error') && typeof value === 'object' && value !== null) {
        sanitized[key] = value; // Mantener error completo
      } else if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }
  return obj;
}

// Función para sanitizar mensajes y datos
function sanitizeMessage(message: string, data?: unknown): { message: string; data?: unknown } {
  let sanitizedMessage = message;
  let sanitizedData = data;

  // Sanitizar datos sensibles en el mensaje
  SENSITIVE_KEYS.forEach(key => {
    const regex = new RegExp(`\\b${key}\\s*[:=]\\s*[^\\s,]+`, 'gi');
    sanitizedMessage = sanitizedMessage.replace(regex, `${key}: [REDACTED]`);
  });

  // Sanitizar datos del objeto
  if (sanitizedData) {
    sanitizedData = sanitizeObject(sanitizedData);
  }

  return { message: sanitizedMessage, data: sanitizedData };
}

// Configuración del logger
const config = loggerConfigSchema.parse({
  level: process.env.LOG_LEVEL || 'info',
  enableConsole: process.env.NODE_ENV !== 'test',
  sanitizeSensitiveData: true,
  development: process.env.NODE_ENV === 'development',
});

// Niveles de logging
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

// Función principal de logging
function log(level: LogLevel, message: string, data?: unknown) {
  if (LOG_LEVELS[level] < LOG_LEVELS[config.level as LogLevel]) {
    return;
  }

  const timestamp = new Date().toISOString();
  const { message: sanitizedMessage, data: sanitizedData } = config.sanitizeSensitiveData
    ? sanitizeMessage(message, data)
    : { message, data };

  if (config.enableConsole) {
    const consoleMethod = level === 'debug' ? 'debug' : level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log';
    console[consoleMethod](`[${level.toUpperCase()}] ${timestamp} - ${sanitizedMessage}`, sanitizedData ? sanitizedData : '');
  }

  // Aquí se podría agregar envío a servicios externos como DataDog, Sentry, etc.
  // if (config.externalService) {
  //   sendToExternalService(logEntry);
  // }
}

// Logger seguro
export const logger = {
  debug: (message: string, data?: unknown) => log('debug', message, data),
  info: (message: string, data?: unknown) => log('info', message, data),
  warn: (message: string, data?: unknown) => log('warn', message, data),
  error: (message: string, data?: unknown) => log('error', message, data),
};

// Función para verificar si el logging está habilitado para un nivel
export function isLogLevelEnabled(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level as LogLevel];
}

// Exportar configuración para testing
export { config, sanitizeObject, sanitizeMessage };
