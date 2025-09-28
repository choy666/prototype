import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServerSession  } from '@/lib/actions/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
    const requestUrl = new URL(request.url);

    // Obtener la URL base desde variables de entorno
    let baseUrl = process.env.NEXTAUTH_URL;
    const isProduction = process.env.NODE_ENV === 'production';

    // En desarrollo o si no está configurada, usar la URL de la solicitud
    if (!baseUrl || !isProduction) {
      const protocol = isProduction ? 'https:' : requestUrl.protocol;
      const host = (await headers()).get('host') || requestUrl.host;
      baseUrl = `${protocol}//${host}`;
    }

    // Forzar HTTPS en producción
    if (isProduction && baseUrl.startsWith('http:')) {
      baseUrl = baseUrl.replace('http:', 'https:');
    }

    // Asegurarse de que la URL base no termine con /
    baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    // Validar sesión del usuario
    const session = await getServerSession();
    if (!session) {
      const loginUrl = new URL('/login', baseUrl);

      // Evitar que el callback sea /login → forzar /dashboard
      const safeCallback =
        requestUrl.pathname === '/login' ? '/dashboard' : requestUrl.pathname;

      loginUrl.searchParams.set('callbackUrl', safeCallback);
      return NextResponse.redirect(loginUrl);
    }

    // Construir y validar la URL de redirección
    let redirectUrl: URL;
    try {
      redirectUrl = new URL(callbackUrl, baseUrl);

      // Prevenir redirecciones a dominios externos
      if (redirectUrl.origin !== new URL(baseUrl).origin) {
        throw new Error('Redirección no permitida');
      }
    } catch (error) {
      console.error('Error al construir URL de redirección:', error);
      redirectUrl = new URL('/dashboard', baseUrl);
    }

    // Redirigir al usuario autenticado
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('Error en el callback de autenticación:', error);
    const fallbackUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return NextResponse.redirect(new URL('/error?code=auth_callback', fallbackUrl));
  }
}
