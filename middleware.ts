import { NextResponse } from "next/server";
import { auth } from "@/lib/actions/auth";
import type { NextRequest } from "next/server";

// Rutas protegidas (requieren sesión activa)
const protectedRoutes = [
  '/dashboard',
  '/checkout',
  '/profile',
  '/orders',
];

export default auth(async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await auth();
  const isLoggedIn = !!session?.user;

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

  // Acceso permitido
  return NextResponse.next();
});

// Configuración del matcher: excluye rutas técnicas
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
