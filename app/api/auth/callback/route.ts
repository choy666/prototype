import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/actions/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const requestUrl = new URL(request.url);
  
  let baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;

  // Fallback si no hay baseUrl configurada
  if (!baseUrl) {
    const protocol = requestUrl.protocol;
    const host = (await headers()).get('host') || requestUrl.host;
    baseUrl = `${protocol}//${host}`;
  }

  // Validar que la baseUrl no sea localhost
  if (!baseUrl || baseUrl.includes('localhost')) {
    console.warn('[MinLU] URL base no válida, usando fallback de producción');
    baseUrl = 'https://prototype-ten-dun.vercel.app';
  }

  // Normalizar baseUrl
  baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  // Validar sesión antes de redirigir
  const session = await auth();
  if (!session && callbackUrl === '/dashboard') {
    console.info('[MinLU] Usuario no autenticado, redirigiendo a /login');
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  // Evitar redirección redundante
  if (requestUrl.pathname === callbackUrl) {
    console.info('[MinLU] Ya estás en la ruta destino, no se redirige');
    return NextResponse.next();
  }

  try {
    const redirectUrl = new URL(
      callbackUrl.startsWith('/') ? callbackUrl : `/${callbackUrl}`,
      baseUrl
    );
    console.info(`[MinLU] Redirigiendo a ${redirectUrl.toString()}`);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[MinLU] Error al construir la URL de redirección:', error);
    return NextResponse.redirect(new URL('/', baseUrl));
  }
}