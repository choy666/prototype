import { NextRequest, NextResponse } from 'next/server';

// Configuración de rate limiting
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 10; // Máximo 10 requests por minuto por IP

// Almacenamiento en memoria (para producción usar Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(request: NextRequest): NextResponse | null {
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown';

  const now = Date.now();
  const key = `${ip}`;

  const current = requestCounts.get(key);

  if (!current || now > current.resetTime) {
    // Primera request o ventana expirada
    requestCounts.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    });
    return null; // Permitir
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit excedido
    const resetIn = Math.ceil((current.resetTime - now) / 1000);
    return NextResponse.json(
      {
        error: 'Demasiadas solicitudes',
        message: `Límite de rate alcanzado. Intenta de nuevo en ${resetIn} segundos.`,
        retryAfter: resetIn
      },
      {
        status: 429,
        headers: {
          'Retry-After': resetIn.toString(),
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': current.resetTime.toString()
        }
      }
    );
  }

  // Incrementar contador
  current.count += 1;
  requestCounts.set(key, current);

  return null; // Permitir
}

// Función para limpiar entradas expiradas (opcional, para memoria)
export function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }
}

// Ejecutar limpieza cada 5 minutos
if (typeof globalThis !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}
