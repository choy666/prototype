// lib/middleware/rate-limit.ts

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
}

// Rate limiting en memoria para serverless ( Vercel )
const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number;    // Ventana de tiempo en milisegundos
  maxRequests: number; // Máximo de solicitudes por ventana
  message?: string;    // Mensaje de error personalizado
}

export async function applyRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  identifier?: string
): Promise<{ success: boolean; response?: NextResponse }> {
  try {
    // Generar identificador único para rate limiting
    const key = generateRateLimitKey(req, identifier);
    const now = Date.now();
    
    // Obtener o crear entrada de rate limiting
    let entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      // Nueva ventana de tiempo
      entry = {
        count: 1,
        resetTime: now + config.windowMs,
        lastAccess: now,
      };
      rateLimitStore.set(key, entry);
      
      logger.debug('[RATE_LIMIT] Nueva ventana iniciada', {
        key,
        windowMs: config.windowMs,
        resetTime: new Date(entry.resetTime).toISOString(),
      });
      
      return { success: true };
    }
    
    // Incrementar contador
    entry.count++;
    entry.lastAccess = now;
    rateLimitStore.set(key, entry);
    
    // Verificar si excede el límite
    if (entry.count > config.maxRequests) {
      logger.warn('[RATE_LIMIT] Límite excedido', {
        key,
        count: entry.count,
        maxRequests: config.maxRequests,
        resetTime: new Date(entry.resetTime).toISOString(),
        userAgent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for') || 'unknown',
      });
      
      const response = NextResponse.json(
        {
          error: config.message || 'Too Many Requests',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
          limit: config.maxRequests,
          windowMs: config.windowMs,
          timestamp: new Date().toISOString(),
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((entry.resetTime - now) / 1000).toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString(),
          }
        }
      );
      
      return { success: false, response };
    }
    
    // Agregar headers informativos
    const remaining = config.maxRequests - entry.count;
    
    logger.debug('[RATE_LIMIT] Request permitida', {
      key,
      count: entry.count,
      remaining,
      resetTime: new Date(entry.resetTime).toISOString(),
    });
    
    return { success: true };
    
  } catch (error) {
    logger.error('[RATE_LIMIT] Error en rate limiting', {
      error: error instanceof Error ? error.message : String(error),
      identifier,
    });
    
    // En caso de error, permitir la solicitud (fail open)
    return { success: true };
  }
}

function generateRateLimitKey(req: NextRequest, customIdentifier?: string): string {
  if (customIdentifier) {
    return `admin:${customIdentifier}`;
  }
  
  // Priorizar IP real del cliente
  const ip = req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             req.headers.get('cf-connecting-ip') || // Cloudflare
             'unknown';
  
  // Para endpoints admin, incluir user-agent para mayor seguridad
  const userAgent = req.headers.get('user-agent')?.slice(0, 50) || 'unknown';
  
  return `admin:${ip}:${userAgent}`;
}

// Configuraciones predefinidas
export const RATE_LIMIT_CONFIGS = {
  // Endpoints críticos: 5 requests por minuto
  CRITICAL: {
    windowMs: 60 * 1000,    // 1 minuto
    maxRequests: 5,
    message: 'Rate limit exceeded for critical admin operations',
  },
  
  // Endpoints admin normales: 20 requests por minuto
  ADMIN: {
    windowMs: 60 * 1000,    // 1 minuto
    maxRequests: 20,
    message: 'Rate limit exceeded for admin operations',
  },
  
  // Endpoints de lectura: 100 requests por minuto
  READ: {
    windowMs: 60 * 1000,    // 1 minuto
    maxRequests: 100,
    message: 'Rate limit exceeded for read operations',
  },
} as const;

// Cleanup de entradas expiradas ( cada 5 minutos )
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime + (5 * 60 * 1000)) { // 5 minutos después de expirar
        rateLimitStore.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('[RATE_LIMIT] Cleanup completado', {
        entriesCleaned: cleaned,
        totalEntries: rateLimitStore.size,
      });
    }
  }, 5 * 60 * 1000); // Cada 5 minutos
}

// Middleware wrapper para endpoints específicos
export function withRateLimit(config: RateLimitConfig, identifier?: string) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const result = await applyRateLimit(req, config, identifier);
    
    if (!result.success && result.response) {
      return result.response;
    }
    
    return null; // Continuar con el request normal
  };
}
