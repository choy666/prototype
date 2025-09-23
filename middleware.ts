// En middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verify, decode, TokenExpiredError } from 'jsonwebtoken';

// Implementación de rate limiter simple
class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly limit: number = 100; // 100 solicitudes
  private readonly windowMs: number = 60 * 1000; // 1 minuto

  public checkRateLimit(ip: string): { allowed: boolean; headers: [string, string][] } {
    const now = Date.now();
    const clientData = this.requests.get(ip) || { count: 0, resetTime: now + this.windowMs };

    // Resetear el contador si ha pasado la ventana de tiempo
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + this.windowMs;
    }

    // Incrementar el contador
    clientData.count += 1;
    this.requests.set(ip, clientData);

    const remaining = Math.max(0, this.limit - clientData.count);
    const resetTime = Math.ceil((clientData.resetTime - now) / 1000);

    return {
      allowed: clientData.count <= this.limit,
      headers: [
        ['X-RateLimit-Limit', this.limit.toString()],
        ['X-RateLimit-Remaining', remaining.toString()],
        ['X-RateLimit-Reset', resetTime.toString()],
      ],
    };
  }
}

const rateLimiter = new RateLimiter();

// Tipos para el token JWT
interface JwtPayload {
  userId: string;
  role?: string;
  iat?: number;
  exp?: number;
}

// Lista blanca de rutas públicas
const publicPaths = ['/api/auth', '/_next', '/favicon.ico', '/api/health'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
  request.headers.get('x-real-ip') || 
  'unknown';

  // Aplicar rate limiting a rutas de autenticación
  if (pathname.startsWith('/api/auth')) {
    const { allowed, headers } = rateLimiter.checkRateLimit(ip);
    
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Demasiadas solicitudes. Por favor, intente de nuevo más tarde.',
          retryAfter: 60
        }),
        { 
          status: 429,
          headers: Object.fromEntries([
            ...headers,
            ['Content-Type', 'application/json'],
            ['Retry-After', '60']
          ])
        }
      );
    }
  }

  // Saltar middleware para rutas públicas
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Si es una ruta de autenticación y el usuario ya está autenticado, redirigir al dashboard
  if (pathname.startsWith('/auth')) {
    if (token) {
      try {
        await verify(token, process.env.JWT_SECRET!);
        return NextResponse.redirect(new URL('/dashboard', request.url));
      } catch (error) {
        // Token inválido, permitir el acceso a la página de autenticación
      }
    }
    return NextResponse.next();
  }

  // Si es una ruta protegida
  if (pathname.startsWith('/dashboard') || 
      pathname.startsWith('/checkout') || 
      pathname.startsWith('/account') || 
      pathname.startsWith('/admin')) {
    
    if (!token) {
      return redirectToLogin(request, pathname);
    }

    try {
      const payload = await verifyToken(token);
      
      // Verificar rol si es ruta de admin
      if (pathname.startsWith('/admin') && payload.role !== 'admin') {
        return new NextResponse('Acceso no autorizado', { 
          status: 403,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      // Renovar token si está por expirar
      return await handleTokenRefresh(token, request);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        const response = redirectToLogin(request, pathname);
        response.cookies.set('session_expired', 'true');
        return response;
      }
      return redirectToLogin(request, pathname);
    }
  }

  return NextResponse.next();
}

// Funciones auxiliares
async function verifyToken(token: string): Promise<JwtPayload> {
  return new Promise((resolve, reject) => {
    verify(token, process.env.JWT_SECRET!, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded as JwtPayload);
    });
  });
}

function redirectToLogin(request: NextRequest, originalPath: string): NextResponse {
  const url = new URL('/auth/login', request.url);
  if (originalPath && !originalPath.startsWith('/auth')) {
    url.searchParams.set('callbackUrl', originalPath);
  }
  const response = NextResponse.redirect(url);
  response.cookies.delete('auth_token');
  response.cookies.delete('session_expired');
  return response;
}

async function handleTokenRefresh(token: string, _request: NextRequest): Promise<NextResponse> {
  const decoded = decode(token) as JwtPayload;
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpire = (decoded.exp || 0) - now;

  // Renovar token si expira en menos de 30 minutos
  if (timeUntilExpire < 1800) {
    const response = NextResponse.next();
    // Lógica de renovación de token...
    return response;
  }

  return NextResponse.next();
}

// Configuración de rutas protegidas
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/checkout/:path*',
    '/account/:path*',
    '/admin/:path*',
    '/auth/:path*',
    '/api/auth/:path*'
  ],
};