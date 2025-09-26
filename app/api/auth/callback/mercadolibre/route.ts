// Forzar el uso de Node.js Runtime para esta ruta
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getToken } from '@/lib/mercadolibre';
import { cookies } from 'next/headers';

// Obtener la URL base según el entorno
const getBaseUrl = () => {
  // En producción, usa NEXT_PUBLIC_SITE_URL o VERCEL_URL
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  // En desarrollo local
  return 'http://localhost:3000';
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;

  // Limpiar la cookie de estado después de usarla
  cookieStore.delete('oauth_state');

  // Manejar errores de autorización de MercadoLibre
  if (error) {
    console.error('Error de autenticación de MercadoLibre:', error);
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(error)}`, getBaseUrl())
    );
  }

  // Validar parámetros requeridos
  if (!code || !state) {
    console.error('Faltan parámetros requeridos:', { code, state });
    return NextResponse.redirect(
      new URL('/auth/error?error=missing_parameters', getBaseUrl())
    );
  }

  // Validar estado para prevenir CSRF
  if (state !== storedState) {
    console.error('Estado de autenticación inválido');
    return NextResponse.redirect(
      new URL('/auth/error?error=invalid_state', getBaseUrl())
    );
  }

  try {
    // Intercambiar código por token de acceso
    const tokens = await getToken(code);
    
    if (!tokens?.access_token) {
      throw new Error('No se pudo obtener el token de acceso');
    }

    // Configuración de la cookie segura
    const isProduction = process.env.NODE_ENV === 'production';
    const domain = isProduction ? new URL(getBaseUrl()).hostname : undefined;
    
    // Guardar el token en una cookie segura
    cookieStore.set('ml_token', tokens.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 semana
      domain,
    });

    // Redirigir al dashboard con la URL base correcta
    return NextResponse.redirect(new URL('/dashboard', getBaseUrl()));
    
  } catch (error) {
    console.error('Error en el proceso de autenticación:', error);
    
    // Redirigir a la página de error con detalles del error
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(errorMessage)}`, getBaseUrl())
    );
  }
}
