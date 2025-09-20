// En middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verify } from 'jsonwebtoken';

// Tipos para el token JWT
interface JwtPayload {
  userId: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.startsWith('/auth');

  // Si es una ruta de autenticación y el usuario ya está autenticado, redirigir al dashboard
  if (isAuthPage && token) {
    try {
      await verify(token, process.env.JWT_SECRET!) as JwtPayload;
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } catch (error) {
      // Token inválido, permitir el acceso a la página de autenticación
    }
  }

  // Si es una ruta protegida
  if (pathname.startsWith('/dashboard') || 
      pathname.startsWith('/checkout') || 
      pathname.startsWith('/account') || 
      pathname.startsWith('/admin')) {
    
    if (!token) {
      const url = new URL('/auth/login', request.url);
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }

    try {
      await verify(token, process.env.JWT_SECRET!) as JwtPayload;
      return NextResponse.next();
    } catch (error) {
      // Token inválido o expirado
      const response = NextResponse.redirect(new URL('/auth/login', request.url));
      response.cookies.delete('auth_token');
      return response;
    }
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
    '/auth/:path*', // Añadido para manejar redirecciones desde páginas de autenticación
  ],
};