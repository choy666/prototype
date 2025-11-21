import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/actions/auth';
import { exchangeCodeForTokens, saveTokens } from '@/lib/auth/mercadolibre';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Verificar si hay error en la respuesta
    if (error) {
      console.error('Error en callback de Mercado Libre:', error);
      return NextResponse.redirect(
        new URL('/admin?error=mercadolibre_auth_failed', request.url)
      );
    }

    // Verificar parámetros requeridos
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/admin?error=mercadolibre_missing_params', request.url)
      );
    }

    // Verificar autenticación del usuario
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.redirect(
        new URL('/admin?error=user_not_authenticated', request.url)
      );
    }

    // Obtener cookies
    const storedState = request.cookies.get('mercadolibre_state')?.value;
    const codeVerifier = request.cookies.get('mercadolibre_code_verifier')?.value;

    // Verificar state para prevenir CSRF
    if (!storedState || state !== storedState) {
      return NextResponse.redirect(
        new URL('/admin?error=mercadolibre_invalid_state', request.url)
      );
    }

    if (!codeVerifier) {
      return NextResponse.redirect(
        new URL('/admin?error=mercadolibre_missing_code_verifier', request.url)
      );
    }

    // Intercambiar code por tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier);

    // Guardar tokens en la base de datos
    await saveTokens(parseInt(session.user.id), tokens);

    // Limpiar cookies
    const response = NextResponse.redirect(
      new URL('/admin?success=mercadolibre_connected', request.url)
    );

    response.cookies.delete('mercadolibre_state');
    response.cookies.delete('mercadolibre_code_verifier');

    return response;

  } catch (error) {
    console.error('Error en callback de Mercado Libre:', error);
    return NextResponse.redirect(
      new URL('/admin?error=mercadolibre_callback_error', request.url)
    );
  }
}
