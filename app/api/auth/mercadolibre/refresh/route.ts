import { NextResponse } from 'next/server';
import { getSession } from '@/lib/actions/auth';
import { getTokens, refreshAccessToken, saveTokens } from '@/lib/auth/mercadolibre';

export async function POST() {
  try {
    // Obtener sesión del usuario
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    // Obtener tokens actuales
    const tokens = await getTokens(userId);
    if (!tokens?.refresh_token) {
      return NextResponse.json({ error: 'No hay refresh token disponible' }, { status: 400 });
    }

    // Verificar si el access token está próximo a expirar (< 5 minutos)
    const isExpiringSoon = tokens.accessTokenExpiresAt
      ? (tokens.accessTokenExpiresAt.getTime() - Date.now()) < 5 * 60 * 1000
      : true;

    if (!isExpiringSoon) {
      return NextResponse.json({ message: 'Token aún válido' }, { status: 200 });
    }

    // Ejecutar refresh
    const newTokens = await refreshAccessToken(tokens.refresh_token);

    // Guardar nuevos tokens
    await saveTokens(userId, {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_in: newTokens.expires_in,
      user_id: tokens.mercadoLibreId!,
    });

    console.log(`Tokens refreshed for user ${userId}`);

    return NextResponse.json({ message: 'Tokens renovados exitosamente' }, { status: 200 });

  } catch (error) {
    console.error('Error refreshing tokens:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
