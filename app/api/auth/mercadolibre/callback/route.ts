import { NextRequest, NextResponse } from 'next/server';
import { saveTokens } from '@/lib/auth/mercadolibre';
import { getSession } from '@/lib/actions/auth';

// Interfaz para los datos del token de Mercado Libre
interface MercadoLibreTokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
}

// Función para guardar tokens en base de datos
async function saveTokensToDatabase(tokenData: MercadoLibreTokenData): Promise<void> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Usuario no autenticado');
  }

  await saveTokens(parseInt(session.user.id), {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
    user_id: tokenData.user_id,
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = request.cookies.get('oauth_state')?.value;

  // Validar state CSRF
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_state`
    );
  }

  try {
    // Intercambiar code por access_token
    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.MERCADOLIBRE_CLIENT_ID!,
        client_secret: process.env.MERCADOLIBRE_CLIENT_SECRET,
        code: code,
        redirect_uri: process.env.MERCADOLIBRE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/mercadolibre/callback`,
      }),
    });

    const tokenData: MercadoLibreTokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json() as { message?: string };
      throw new Error(`Error en token: ${errorData.message || 'Error desconocido'}`);
    }

    // Guardar tokens en base de datos
    await saveTokensToDatabase(tokenData);

    // Limpiar cookie state
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?auth=success`
    );
    response.cookies.delete('oauth_state');
    
    return response;
  } catch (error) {
    console.error('Error en callback ML:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=token_exchange_failed`
    );
  }
}
