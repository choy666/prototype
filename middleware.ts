// middleware.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

// Rutas protegidas (requieren sesión activa)
const protectedRoutes = [
  '/dashboard',
  '/checkout',
  '/profile',
  '/orders',
];

// Rutas que requieren validación adicional para checkout
const checkoutRoutes = [
  '/checkout',
  '/api/checkout',
  '/api/order-status',
];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Obtener token de sesión de las cookies
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("next-auth.session-token")?.value ||
                       cookieStore.get("__Secure-next-auth.session-token")?.value;

  let isLoggedIn = false;
  if (sessionToken) {
    // Para Edge Runtime, simplemente verificar que existe el token
    // La validación completa se hará en las rutas protegidas
    isLoggedIn = true;
  }

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

  // Redirección si accede a login/register estando autenticado
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register');
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
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

  // Acceso permitido
  return NextResponse.next();
}

// Configuración del matcher: excluye rutas técnicas
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};