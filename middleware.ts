// middleware.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/actions/auth";
import { checkRateLimit } from "@/lib/rate-limit";

// Rutas protegidas (requieren sesión activa)
const protectedRoutes = [
  '/dashboard',
  '/checkout',
  '/profile',
  '/orders',
];

// Rutas de admin (requieren role 'admin')
const adminRoutes = [
  '/admin',
];

// Rutas que requieren validación adicional para checkout
const checkoutRoutes = [
  '/checkout',
  '/api/checkout',
  '/api/order-status',
];

// Rutas de usuario que admins no pueden acceder
const userRestrictedRoutes = [
  '/orders',
  '/api/orders',
];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Forzar HTTPS en producción
  if (request.nextUrl.protocol === 'http:' && process.env.NODE_ENV === 'production') {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    return NextResponse.redirect(url, 301);
  }

  // Aplicar rate limiting a endpoints de MercadoLibre
  if (pathname.startsWith('/api/auth/mercadolibre')) {
    const rateLimitResponse = checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  // Obtener sesión completa para verificar role
  const session = await auth();

  let isLoggedIn = !!session;
  let isAdmin = session?.user?.role === 'admin';

  // Excluir rutas técnicas (API, assets, favicon)
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  // Redirección si accede a ruta protegida sin sesión
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirección si accede a rutas de admin sin ser admin
  const isAdminRoute = adminRoutes.some(route =>
    pathname.startsWith(route)
  );

  if (isAdminRoute && (!isLoggedIn || !isAdmin)) {
    if (!isLoggedIn) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    } else {
      // Usuario logueado pero no admin
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Redirección si accede a login/register estando autenticado
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register');
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirección especial para admins: si acceden a /dashboard, ir a /admin
  if (pathname === '/dashboard' && isLoggedIn && isAdmin) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Validaciones adicionales para rutas de checkout
  const isCheckoutRoute = checkoutRoutes.some(route =>
    pathname.startsWith(route)
  );

  if (isCheckoutRoute && isLoggedIn) {
    // Verificar que el usuario tenga un carrito activo o esté en proceso de checkout
    // Para APIs de checkout, la validación específica se hace en las rutas
    // Aquí solo aseguramos que esté autenticado
  }

  // Acceso permitido con headers de seguridad
  const response = NextResponse.next();
  
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
  
  return response;
}

// Configuración del matcher: excluye rutas técnicas
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};