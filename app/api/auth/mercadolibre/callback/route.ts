import { NextRequest, NextResponse } from 'next/server';
import { saveTokens, getUserInfo } from '@/lib/auth/mercadolibre';
import { getSession } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

// Interfaz para los datos del token de Mercado Libre
interface MercadoLibreTokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
  scope?: string;
}

// Función para guardar tokens en base de datos con información adicional
async function saveTokensToDatabase(tokenData: MercadoLibreTokenData): Promise<void> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Usuario no autenticado');
  }

  const userId = parseInt(session.user.id);
  
  try {
    // Obtener información adicional del usuario
    const userInfo = await getUserInfo(tokenData.access_token);
    
    logger.info('MercadoLibre: Obteniendo información de usuario', {
      userId,
      mlUserId: tokenData.user_id,
      nickname: userInfo.nickname,
      scopes: tokenData.scope
    });

    // Guardar tokens y datos adicionales
    await saveTokens(userId, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      user_id: tokenData.user_id,
    });

    // Actualizar información adicional del usuario
    await db.update(users)
      .set({
        mlNickname: userInfo.nickname,
        mercadoLibreScopes: tokenData.scope || '',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('MercadoLibre: Tokens guardados exitosamente', {
      userId,
      mlUserId: tokenData.user_id,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000)
    });

  } catch (error) {
    logger.error('MercadoLibre: Error guardando tokens en BD', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const storedState = request.cookies.get('mercadolibre_state')?.value;
  const codeVerifier = request.cookies.get('mercadolibre_code_verifier')?.value;

  logger.info('MercadoLibre: Callback recibido', {
    hasCode: !!code,
    hasError: !!error,
    error,
    errorDescription,
    hasState: !!state,
    hasStoredState: !!storedState,
    hasCodeVerifier: !!codeVerifier
  });

  // Manejar errores de OAuth
  if (error) {
    logger.error('MercadoLibre: Error en OAuth', {
      error,
      errorDescription,
      state
    });
    
    // Limpiar cookies en error
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=oauth_failed&message=${encodeURIComponent(errorDescription || error)}`
    );
    response.cookies.delete('mercadolibre_state');
    response.cookies.delete('mercadolibre_code_verifier');
    return response;
  }

  // Validar state CSRF
  if (!state || !storedState || state !== storedState) {
    logger.error('MercadoLibre: Validación state fallida', {
      receivedState: state,
      storedState: storedState,
      match: state === storedState
    });
    
    // Limpiar cookies en validación fallida
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_state`
    );
    response.cookies.delete('mercadolibre_state');
    response.cookies.delete('mercadolibre_code_verifier');
    return response;
  }

  if (!code) {
    logger.error('MercadoLibre: Código de autorización faltante');
    
    // Limpiar cookies en código faltante
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=no_code`
    );
    response.cookies.delete('mercadolibre_state');
    response.cookies.delete('mercadolibre_code_verifier');
    return response;
  }

  if (!codeVerifier) {
    logger.error('MercadoLibre: Code verifier faltante - PKCE incompleto');
    
    // Limpiar cookies en code_verifier faltante
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=no_code_verifier`
    );
    response.cookies.delete('mercadolibre_state');
    response.cookies.delete('mercadolibre_code_verifier');
    return response;
  }

  try {
    logger.info('MercadoLibre: Iniciando intercambio de código por tokens', { codeLength: code.length });
    
    // Intercambiar code por access_token usando PKCE
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
        code_verifier: codeVerifier,
      }),
    });

    const tokenData: MercadoLibreTokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json() as { message?: string; error?: string };
      logger.error('MercadoLibre: Error en intercambio de tokens', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorData,
        tokenData
      });
      throw new Error(`Error en token: ${errorData.message || errorData.error || 'Error desconocido'}`);
    }

    logger.info('MercadoLibre: Tokens obtenidos exitosamente', {
      userId: tokenData.user_id,
      expiresIn: tokenData.expires_in,
      hasScope: !!tokenData.scope,
      scope: tokenData.scope
    });

    // Guardar tokens en base de datos
    await saveTokensToDatabase(tokenData);

    // Limpiar cookies en éxito
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?auth=success&connected=mercadolibre`
    );
    response.cookies.delete('mercadolibre_state');
    response.cookies.delete('mercadolibre_code_verifier');
    
    logger.info('MercadoLibre: Proceso de autenticación completado exitosamente');
    return response;
    
  } catch (error) {
    logger.error('MercadoLibre: Error en callback', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Limpiar cookies en error general
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=token_exchange_failed&message=${encodeURIComponent(error instanceof Error ? error.message : 'Error desconocido')}`
    );
    response.cookies.delete('mercadolibre_state');
    response.cookies.delete('mercadolibre_code_verifier');
    return response;
  }
}
