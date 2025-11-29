import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { retryWithBackoff } from '@/lib/utils/retry';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { logger } from '@/lib/utils/logger';

// Configuración de Mercado Libre
export const MERCADOLIBRE_CONFIG = {
  clientId: process.env.MERCADOLIBRE_CLIENT_ID!,
  clientSecret: process.env.MERCADOLIBRE_CLIENT_SECRET!,
  redirectUri: process.env.MERCADOLIBRE_REDIRECT_URI || 'https://prototype-ten-dun.vercel.app/api/auth/mercadolibre/callback',
  baseUrl: 'https://api.mercadolibre.com',
  apiUrl: 'https://api.mercadolibre.com',
};

// Generar code_verifier para PKCE
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// Generar code_challenge desde code_verifier
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

// Codificación base64 URL-safe
function base64URLEncode(array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Generar state para prevenir CSRF
export function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// Intercambiar code por tokens
export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  user_id: string;
  token_type: string;
}> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: MERCADOLIBRE_CONFIG.clientId,
    client_secret: MERCADOLIBRE_CONFIG.clientSecret,
    code,
    redirect_uri: MERCADOLIBRE_CONFIG.redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await retryWithBackoff(async () => {
    const res = await fetch(`${MERCADOLIBRE_CONFIG.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });
    
    if (!res.ok) {
      const error = await res.text();
      throw new MercadoLibreError(
        MercadoLibreErrorCode.AUTH_FAILED,
        `Error intercambiando código por tokens: ${error}`,
        { status: res.status, error }
      );
    }
    
    return res;
  }, {
    maxRetries: 3,
    shouldRetry: (error) => {
      // Reintentar solo en errores de red o del servidor
      return error instanceof MercadoLibreError && 
             (error.code === MercadoLibreErrorCode.CONNECTION_ERROR ||
              error.code === MercadoLibreErrorCode.TIMEOUT_ERROR ||
              error.code === MercadoLibreErrorCode.API_UNAVAILABLE);
    }
  });

  return response.json();
}

// Refresh token
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: MERCADOLIBRE_CONFIG.clientId,
    client_secret: MERCADOLIBRE_CONFIG.clientSecret,
    refresh_token: refreshToken,
  });

  const response = await retryWithBackoff(async () => {
    const res = await fetch(`${MERCADOLIBRE_CONFIG.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });
    
    if (!res.ok) {
      const error = await res.text();
      throw new MercadoLibreError(
        MercadoLibreErrorCode.AUTH_FAILED,
        `Error refrescando token: ${error}`,
        { status: res.status, error }
      );
    }
    
    return res;
  }, {
    maxRetries: 3,
    shouldRetry: (error) => {
      return error instanceof MercadoLibreError && 
             (error.code === MercadoLibreErrorCode.CONNECTION_ERROR ||
              error.code === MercadoLibreErrorCode.TIMEOUT_ERROR ||
              error.code === MercadoLibreErrorCode.API_UNAVAILABLE);
    }
  });

  return response.json();
}

// Obtener información del usuario de Mercado Libre
export async function getUserInfo(accessToken: string): Promise<{
  id: string;
  nickname: string;
  email: string;
  first_name: string;
  last_name: string;
}> {
  const response = await fetch(`${MERCADOLIBRE_CONFIG.apiUrl}/users/me`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error getting user info: ${response.statusText}`);
  }

  return response.json();
}

// Guardar tokens en BD
export async function saveTokens(userId: number, tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
}): Promise<void> {
  const now = new Date();
  const accessTokenExpiresAt = new Date(now.getTime() + tokens.expires_in * 1000);
  // Estimar expiración del refresh token en ~6 meses según ML
  const refreshTokenExpiresAt = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);

  await db.update(users)
    .set({
      mercadoLibreId: tokens.user_id,
      mercadoLibreAccessToken: tokens.access_token,
      mercadoLibreRefreshToken: tokens.refresh_token,
      mercadoLibreAccessTokenExpiresAt: accessTokenExpiresAt,
      mercadoLibreRefreshTokenExpiresAt: refreshTokenExpiresAt,
      updatedAt: now,
    })
    .where(eq(users.id, userId));
}

// Obtener tokens de BD
export async function getTokens(userId: number): Promise<{
  access_token: string | null;
  refresh_token: string | null;
  mercadoLibreId: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
} | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      mercadoLibreAccessToken: true,
      mercadoLibreRefreshToken: true,
      mercadoLibreId: true,
      mercadoLibreAccessTokenExpiresAt: true,
      mercadoLibreRefreshTokenExpiresAt: true,
    },
  });

  if (!user) return null;

  return {
    access_token: user.mercadoLibreAccessToken,
    refresh_token: user.mercadoLibreRefreshToken,
    mercadoLibreId: user.mercadoLibreId,
    accessTokenExpiresAt: user.mercadoLibreAccessTokenExpiresAt,
    refreshTokenExpiresAt: user.mercadoLibreRefreshTokenExpiresAt,
  };
}

// Verificar si el usuario está conectado a Mercado Libre
export async function isConnected(userId: number): Promise<boolean> {
  const tokens = await getTokens(userId);
  return !!(tokens?.access_token && tokens?.mercadoLibreId);
}

// Helper para verificar si un token ha expirado
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= Date.now();
}

// Hacer una request autenticada a la API de Mercado Libre con refresh automático
export async function makeAuthenticatedRequest(
  userId: number,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const tokens = await getTokens(userId);
    if (!tokens?.access_token) {
      throw new Error('Usuario no conectado a Mercado Libre');
    }

    // Verificar si el access token está expirado y refrescar si es necesario
    if (isTokenExpired(tokens.accessTokenExpiresAt)) {
      logger.info('MercadoLibre: Access token expirado, intentando refrescar', { userId });
      
      if (!tokens.refresh_token || isTokenExpired(tokens.refreshTokenExpiresAt)) {
        throw new Error('Tokens expirados. Se requiere重新autenticación');
      }

      try {
        const newTokens = await refreshAccessToken(tokens.refresh_token);
        
        // Actualizar tokens en la base de datos
        const now = new Date();
        const newAccessTokenExpiresAt = new Date(now.getTime() + newTokens.expires_in * 1000);
        
        await db.update(users)
          .set({
            mercadoLibreAccessToken: newTokens.access_token,
            mercadoLibreRefreshToken: newTokens.refresh_token,
            mercadoLibreAccessTokenExpiresAt: newAccessTokenExpiresAt,
            mercadoLibreScopes: newTokens.scope || '',
            updatedAt: now,
          })
          .where(eq(users.id, userId));

        logger.info('MercadoLibre: Tokens refrescados exitosamente', { userId });
        
        // Usar el nuevo token
        tokens.access_token = newTokens.access_token;
        
      } catch (refreshError) {
        logger.error('MercadoLibre: Error refrescando tokens', {
          userId,
          error: refreshError instanceof Error ? refreshError.message : String(refreshError)
        });
        
        // Limpiar tokens inválidos
        await db.update(users)
          .set({
            mercadoLibreAccessToken: null,
            mercadoLibreRefreshToken: null,
            mercadoLibreAccessTokenExpiresAt: null,
            mercadoLibreRefreshTokenExpiresAt: null,
            mercadoLibreScopes: null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
        
        throw new Error('Tokens expirados. Se requiere重新autenticación');
      }
    }

    const url = endpoint.startsWith('http') ? endpoint : `${MERCADOLIBRE_CONFIG.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Si recibimos 401 o 403, puede ser que el token fue revocado
    if (response.status === 401 || response.status === 403) {
      logger.warn('MercadoLibre: Token rechazado por la API', {
        userId,
        status: response.status,
        endpoint
      });
      
      // Limpiar tokens inválidos
      await db.update(users)
        .set({
          mercadoLibreAccessToken: null,
          mercadoLibreRefreshToken: null,
          mercadoLibreAccessTokenExpiresAt: null,
          mercadoLibreRefreshTokenExpiresAt: null,
          mercadoLibreScopes: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      
      throw new Error('Token invalidado por la API. Se requiere重新autenticación');
    }

    return response;
    
  } catch (error) {
    logger.error('MercadoLibre: Error en request autenticada', {
      userId,
      endpoint,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Scopes requeridos por módulo
export const REQUIRED_SCOPES = {
  auth: ['read'],
  products: ['write', 'read'],
  inventory: ['write', 'read'],
  orders: ['read', 'write'],
  messages: ['read', 'write'],
} as const;

// Scopes críticos que requieren alerta inmediata
export const CRITICAL_SCOPES = ['write', 'read'];

// Obtener scopes activos del usuario desde Mercado Libre
export async function getMercadoLibreScopes(userId: number): Promise<string[]> {
  try {
    const tokens = await getTokens(userId);
    if (!tokens?.access_token) {
      throw new Error('Usuario no conectado a Mercado Libre');
    }

    // Obtener información de la aplicación usando el endpoint /applications/{app_id}
    const appId = process.env.MERCADOLIBRE_CLIENT_ID;
    if (!appId) {
      throw new Error('MERCADOLIBRE_CLIENT_ID no configurado');
    }

    const response = await makeAuthenticatedRequest(
      userId,
      `/applications/${appId}`,
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error obteniendo información de aplicación: ${response.statusText}`);
    }

    const appData = await response.json();

    // Los scopes están en el campo 'scopes' o pueden obtenerse del cache
    // Si no están disponibles directamente, usar los scopes cacheados
    const scopes = appData.scopes || (await getCachedScopes(userId)) || [];

    // Guardar scopes en BD para futuras validaciones
    await saveScopes(userId, scopes);

    return scopes;
  } catch (error) {
    console.error('Error obteniendo scopes de Mercado Libre:', error);
    throw error;
  }
}

// Validar si el usuario tiene los scopes requeridos
export async function validateMercadoLibreScopes(
  userId: number,
  requiredScopes: readonly string[]
): Promise<{
  hasAllScopes: boolean;
  missingScopes: string[];
  availableScopes: string[];
}> {
  try {
    const availableScopes = await getMercadoLibreScopes(userId);

    const missingScopes = requiredScopes.filter(scope => !availableScopes.includes(scope));

    return {
      hasAllScopes: missingScopes.length === 0,
      missingScopes,
      availableScopes,
    };
  } catch (error) {
    console.error('Error validando scopes:', error);
    // En caso de error, asumir que no tiene scopes
    return {
      hasAllScopes: false,
      missingScopes: [...requiredScopes],
      availableScopes: [],
    };
  }
}

// Verificar scopes críticos
export async function checkCriticalScopes(userId: number): Promise<{
  hasCriticalScopes: boolean;
  missingCriticalScopes: string[];
}> {
  const validation = await validateMercadoLibreScopes(userId, CRITICAL_SCOPES);

  return {
    hasCriticalScopes: validation.hasAllScopes,
    missingCriticalScopes: validation.missingScopes,
  };
}

// Guardar scopes en BD
async function saveScopes(userId: number, scopes: string[]): Promise<void> {
  const now = new Date();
  const scopesString = scopes.join(',');

  await db.update(users)
    .set({
      mercadoLibreScopes: scopesString,
      updatedAt: now,
    })
    .where(eq(users.id, userId));
}

// Obtener scopes desde BD (cache)
export async function getCachedScopes(userId: number): Promise<string[] | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      mercadoLibreScopes: true,
    },
  });

  if (!user?.mercadoLibreScopes) return null;

  return user.mercadoLibreScopes.split(',');
}

// Clase MercadoLibreAuth para compatibilidad con shipments
export class MercadoLibreAuth {
  private static instance: MercadoLibreAuth;
  
  public static getInstance(): MercadoLibreAuth {
    if (!MercadoLibreAuth.instance) {
      MercadoLibreAuth.instance = new MercadoLibreAuth();
    }
    return MercadoLibreAuth.instance;
  }
  
  private async refreshAndPersist(userId: number, refreshToken: string): Promise<string> {
    try {
      const newTokens = await refreshAccessToken(refreshToken);
      
      // Guardar tokens actualizados en BD
      const now = new Date();
      const newAccessTokenExpiresAt = new Date(now.getTime() + newTokens.expires_in * 1000);
      
      await db.update(users)
        .set({
          mercadoLibreAccessToken: newTokens.access_token,
          mercadoLibreRefreshToken: newTokens.refresh_token,
          mercadoLibreAccessTokenExpiresAt: newAccessTokenExpiresAt,
          mercadoLibreScopes: newTokens.scope || '',
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      logger.info('MercadoLibreAuth: Tokens refrescados y persistidos', { userId });
      return newTokens.access_token;
      
    } catch (error) {
      logger.error('MercadoLibreAuth: Error refrescando y persistiendo tokens', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Limpiar tokens inválidos
      await db.update(users)
        .set({
          mercadoLibreAccessToken: null,
          mercadoLibreRefreshToken: null,
          mercadoLibreAccessTokenExpiresAt: null,
          mercadoLibreRefreshTokenExpiresAt: null,
          mercadoLibreScopes: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      
      throw error;
    }
  }
  
  public async getAccessToken(): Promise<string> {
    // Obtener el primer usuario con tokens de ML
    const user = await db.query.users.findFirst({
      where: (users, { isNotNull }) => isNotNull(users.mercadoLibreAccessToken),
      columns: {
        mercadoLibreAccessToken: true,
        mercadoLibreRefreshToken: true,
        mercadoLibreAccessTokenExpiresAt: true,
        id: true,
      },
    });
    
    if (!user?.mercadoLibreAccessToken) {
      throw new Error('No se encontró token de acceso de Mercado Libre');
    }
    
    // Verificar si el token ha expirado y refresh si es necesario
    if (user.mercadoLibreAccessTokenExpiresAt && new Date() > user.mercadoLibreAccessTokenExpiresAt) {
      if (user.mercadoLibreRefreshToken) {
        return await this.refreshAndPersist(user.id, user.mercadoLibreRefreshToken);
      } else {
        throw new Error('Token de acceso expirado y no hay refresh token');
      }
    }
    
    return user.mercadoLibreAccessToken;
  }
  
  // Método público para refresh explícito (usado por me2-shipping.ts)
  public async refreshAccessToken(): Promise<string> {
    // Obtener el primer usuario con refresh token
    const user = await db.query.users.findFirst({
      where: (users, { isNotNull }) => isNotNull(users.mercadoLibreRefreshToken),
      columns: {
        mercadoLibreRefreshToken: true,
        id: true,
      },
    });
    
    if (!user?.mercadoLibreRefreshToken) {
      throw new Error('No se encontró refresh token de Mercado Libre');
    }
    
    return await this.refreshAndPersist(user.id, user.mercadoLibreRefreshToken);
  }
}
