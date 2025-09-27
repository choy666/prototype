import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  
  // Obtener la URL base de la solicitud actual
  const requestUrl = new URL(request.url);
  let baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
  
  // Si no hay URL base configurada, usar la URL de la solicitud
  if (!baseUrl) {
    const protocol = requestUrl.protocol;
    const host = (await headers()).get('host') || requestUrl.host;
    baseUrl = `${protocol}//${host}`;
  }

  // Validar que la URL base sea segura
  if (!baseUrl || baseUrl.includes('localhost')) {
    console.error('URL base no válida o no configurada:', baseUrl);
    // Usar la URL de producción como último recurso
    baseUrl = 'https://prototype-ten-dun.vercel.app';
  }

  // Asegurar que la URL base no termine con /
  baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  try {
    // Crear la URL de redirección
    const redirectUrl = new URL(callbackUrl.startsWith('/') ? callbackUrl : `/${callbackUrl}`, baseUrl);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Error al construir la URL de redirección:', error);
    // Redirigir a la página de inicio como último recurso
    return NextResponse.redirect(new URL('/', baseUrl));
  }
}