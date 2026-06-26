import { getTokens, refreshAccessToken, saveTokens } from '@/lib/auth/mercadolibre';
import { getApiUrl } from '@/lib/config/integrations';

// Middleware para hacer requests autenticadas con refresh automático
export async function withMercadoLibreAuth<T>(
  userId: number,
  requestFn: (accessToken: string) => Promise<T>
): Promise<T> {
  let tokens = await getTokens(userId);
  if (!tokens?.access_token) {
    throw new Error('Usuario no conectado a Mercado Libre');
  }

  // Verificar si el access token está próximo a expirar (< 10 minutos)
  const shouldRefresh = tokens.accessTokenExpiresAt
    ? (tokens.accessTokenExpiresAt.getTime() - Date.now()) < 10 * 60 * 1000
    : true;

  if (shouldRefresh && tokens.refresh_token) {
    try {
      console.log(`Refreshing tokens for user ${userId}`);
      const newTokens = await refreshAccessToken(tokens.refresh_token);

      await saveTokens(userId, {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_in: newTokens.expires_in,
        user_id: tokens.mercadoLibreId!,
      });

      tokens = await getTokens(userId);
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      // Si el refresh falla, limpiar tokens
      await saveTokens(userId, {
        access_token: '',
        refresh_token: '',
        expires_in: 0,
        user_id: '',
      });
      throw new Error('Error renovando tokens de Mercado Libre');
    }
  }

  if (!tokens?.access_token) {
    throw new Error('No valid access token after refresh');
  }

  // Ejecutar la request con el token válido
  return await requestFn(tokens.access_token);
}

// Wrapper para makeAuthenticatedRequest con refresh automático
export async function makeAuthenticatedRequestWithRefresh(
  userId: number,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return withMercadoLibreAuth(userId, async (accessToken) => {
    const url = endpoint.startsWith('http') ? endpoint : getApiUrl('mercadolibre', endpoint);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Si obtenemos 401, intentar refresh y reintentar una vez
    if (response.status === 401) {
      console.log(`Token expired for user ${userId}, attempting refresh`);
      const tokens = await getTokens(userId);
      if (tokens?.refresh_token) {
        try {
          const newTokens = await refreshAccessToken(tokens.refresh_token);
          await saveTokens(userId, {
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            expires_in: newTokens.expires_in,
            user_id: tokens.mercadoLibreId!,
          });

          // Reintentar la request con el nuevo token
          const newTokensData = await getTokens(userId);
          if (newTokensData?.access_token) {
            const retryResponse = await fetch(url, {
              ...options,
              headers: {
                'Authorization': `Bearer ${newTokensData.access_token}`,
                'Content-Type': 'application/json',
                ...options.headers,
              },
            });

            return retryResponse;
          }
        } catch (retryError) {
          console.error('Error retrying request after refresh:', retryError);
        }
      }
    }

    return response;
  });
}
