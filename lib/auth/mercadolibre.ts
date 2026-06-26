import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { retryWithBackoff } from '@/lib/utils/retry';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { logger } from '@/lib/utils/logger';
import { getApiUrl, getMercadoLibreConfig } from '@/lib/config/integrations';

// Configuración centralizada
export const MERCADOLIBRE_CONFIG = getMercadoLibreConfig();
const MERCADOLIBRE_BASE_URL =
  MERCADOLIBRE_CONFIG.apiBaseUrl || getApiUrl('mercadolibre', '');
const REQUIRED_OAUTH_SCOPES = MERCADOLIBRE_CONFIG.oauthScopes;

export type MercadoLibreReauthReason =
  | 'invalid_token'
  | 'token_expired'
  | 'scope_missing'
  | 'manual'
  | 'refresh_failed'
  | 'auth_error'
  | 'unknown';

type MarkReauthOptions = {
  preserveTokens?: boolean;
};

function parseScopeString(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function serializeScopes(scopes: string[]): string {
  return Array.from(new Set(scopes))
    .map((scope) => scope.trim())
    .filter(Boolean)
    .join(' ');
}

function assertOAuthCredentials() {
  const { appId, clientSecret, redirectUri } = MERCADOLIBRE_CONFIG;
  if (!appId || !clientSecret) {
    throw new Error('Mercado Libre OAuth credentials are not configured');
  }
  if (!redirectUri) {
    throw new Error('Mercado Libre redirect URI is not configured');
  }
  return {
    clientId: appId,
    clientSecret,
    redirectUri,
  };
}

export function buildMercadoLibreAuthUrl(params: {
  state: string;
  codeChallenge: string;
}) {
  const { clientId, redirectUri } = assertOAuthCredentials();
  const authUrl = new URL(
    MERCADOLIBRE_CONFIG.authUrl ||
      'https://auth.mercadolibre.com.ar/authorization'
  );
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('code_challenge', params.codeChallenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');
  authUrl.searchParams.append('state', params.state);
  authUrl.searchParams.append('scope', REQUIRED_OAUTH_SCOPES.join(' '));
  return authUrl.toString();
}

export async function markUserNeedsReauth(
  userId: number,
  reason: MercadoLibreReauthReason,
  options: MarkReauthOptions = {}
) {
  const now = new Date();
  const updateData: Partial<typeof users.$inferInsert> = {
    mlNeedsReauth: true,
    mlReauthReason: reason,
    updatedAt: now,
  };

  if (!options.preserveTokens) {
    Object.assign(updateData, {
      mercadoLibreAccessToken: null,
      mercadoLibreRefreshToken: null,
      mercadoLibreAccessTokenExpiresAt: null,
      mercadoLibreRefreshTokenExpiresAt: null,
      mercadoLibreScopes: null,
    });
  }

  await db.update(users).set(updateData).where(eq(users.id, userId));
}

export async function clearMercadoLibreReauthFlag(userId: number) {
  await db
    .update(users)
    .set({
      mlNeedsReauth: false,
      mlReauthReason: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

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
  const { clientId, clientSecret, redirectUri } = assertOAuthCredentials();
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await retryWithBackoff(async () => {
    const res = await fetch(`${MERCADOLIBRE_BASE_URL}/oauth/token`, {
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
    shouldRetry: (error: unknown) => {
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
  const { clientId, clientSecret } = assertOAuthCredentials();
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await retryWithBackoff(async () => {
    const res = await fetch(`${MERCADOLIBRE_BASE_URL}/oauth/token`, {
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
  site_id?: string;
  permalink?: string;
  user_type?: string;
  seller_experience?: string;
  status?: Record<string, unknown>;
  tags?: string[];
}> {
  const response = await fetch(getApiUrl('mercadolibre', '/users/me'), {
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

async function fetchApplicationScopes(accessToken: string): Promise<string[]> {
  const appId = MERCADOLIBRE_CONFIG.appId;
  if (!appId) {
    throw new Error('Mercado Libre appId is not configured');
  }

  const response = await fetch(`${MERCADOLIBRE_BASE_URL}/applications/${appId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text().catch(() => response.statusText);
    throw new Error(`Error fetching application scopes: ${error}`);
  }

  const data = await response.json();
  const rawScopes = data?.scopes;

  if (Array.isArray(rawScopes)) {
    return rawScopes.filter((scope: unknown): scope is string => typeof scope === 'string' && scope.length > 0);
  }

  if (typeof rawScopes === 'string') {
    return rawScopes
      .split(/[\s,]+/)
      .map((scope: string) => scope.trim())
      .filter(Boolean);
  }

  return [];
}

export async function syncMercadoLibreScopes(
  userId: number,
  accessToken: string
): Promise<string[] | null> {
  try {
    const scopes = await fetchApplicationScopes(accessToken);
    if (scopes.length > 0) {
      await saveScopes(userId, scopes);
      return scopes;
    }
    return null;
  } catch (error) {
    logger.warn('MercadoLibre: No se pudieron sincronizar los scopes de la aplicación', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Guardar tokens en BD
export async function saveTokens(
  userId: number,
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: string;
    scope?: string;
  }
): Promise<void> {
  const now = new Date();
  const accessTokenExpiresAt = new Date(now.getTime() + tokens.expires_in * 1000);
  // Estimar expiración del refresh token en ~6 meses según ML
  const refreshTokenExpiresAt = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
  const normalizedScopes = tokens.scope
    ? serializeScopes(parseScopeString(tokens.scope))
    : null;

  await db.update(users)
    .set({
      mercadoLibreId: tokens.user_id,
      mercadoLibreAccessToken: tokens.access_token,
      mercadoLibreRefreshToken: tokens.refresh_token,
      mercadoLibreAccessTokenExpiresAt: accessTokenExpiresAt,
      mercadoLibreRefreshTokenExpiresAt: refreshTokenExpiresAt,
      mercadoLibreScopes: normalizedScopes,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  await clearMercadoLibreReauthFlag(userId);
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
  const tokens = await getTokens(userId);
  if (!tokens?.access_token) {
    throw new Error('Usuario no conectado a Mercado Libre');
  }

  let currentTokens = { ...tokens };

  const ensureFreshToken = async () => {
    if (!isTokenExpired(currentTokens.accessTokenExpiresAt)) {
      return;
    }

    if (!currentTokens.refresh_token || isTokenExpired(currentTokens.refreshTokenExpiresAt)) {
      await markUserNeedsReauth(userId, 'token_expired');
      throw new Error('Tokens expirados. Se requiere重新autenticación');
    }

    const newTokens = await refreshAccessToken(currentTokens.refresh_token);
    const now = new Date();
    const newAccessTokenExpiresAt = new Date(now.getTime() + newTokens.expires_in * 1000);

    await db
      .update(users)
      .set({
        mercadoLibreAccessToken: newTokens.access_token,
        mercadoLibreRefreshToken: newTokens.refresh_token,
        mercadoLibreAccessTokenExpiresAt: newAccessTokenExpiresAt,
        mercadoLibreScopes: newTokens.scope || '',
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    await syncMercadoLibreScopes(userId, newTokens.access_token);

    currentTokens = {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      mercadoLibreId: currentTokens.mercadoLibreId,
      accessTokenExpiresAt: newAccessTokenExpiresAt,
      refreshTokenExpiresAt: new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000),
    };
  };

  await ensureFreshToken();

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${MERCADOLIBRE_BASE_URL}${endpoint}`;

  const performRequest = async (tokenOverride?: string) => {
    const bearer = tokenOverride ?? currentTokens.access_token;
    if (!bearer) {
      throw new Error('Token de acceso no disponible');
    }

    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  };

  let response = await performRequest();

  if (response.status === 401 || response.status === 403) {
    const errorBody = await response.text().catch(() => '');
    const refreshable = currentTokens.refresh_token && !isTokenExpired(currentTokens.refreshTokenExpiresAt);

    if (refreshable) {
      try {
        await ensureFreshToken();
        response = await performRequest();
        if (response.ok) {
          return response;
        }
      } catch (refreshError) {
        logger.error('MercadoLibre: Error refrescando después de 401/403', {
          userId,
          error: refreshError instanceof Error ? refreshError.message : String(refreshError),
        });
      }
    }

    const bodySnippet = errorBody.substring(0, 200);
    const isTokenRevoked =
      bodySnippet.includes('invalid_token') ||
      bodySnippet.includes('token_revoked') ||
      bodySnippet.includes('expired_token');
    const isScopeError =
      bodySnippet.includes('forbidden') ||
      bodySnippet.includes('insufficient_scope') ||
      bodySnippet.includes('permission denied');

    if (isTokenRevoked) {
      await markUserNeedsReauth(userId, 'invalid_token');
      throw new Error('Token invalidado por la API. Se requiere重新autenticación');
    }

    if (isScopeError || response.status === 403) {
      await markUserNeedsReauth(userId, 'scope_missing', { preserveTokens: true });
      throw new Error(
        `Error de permisos: ${bodySnippet || response.statusText}. Es posible que necesites re-autorizar con permisos adicionales.`,
      );
    }

    await markUserNeedsReauth(userId, 'auth_error', { preserveTokens: true });
    throw new Error(`Error de autenticación temporal: ${bodySnippet || response.statusText}`);
  }

  return response;
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
  const scopesString = serializeScopes(scopes);

  await db
    .update(users)
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

  return parseScopeString(user.mercadoLibreScopes);
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
      const now = new Date();
      const newAccessTokenExpiresAt = new Date(now.getTime() + newTokens.expires_in * 1000);

      await db
        .update(users)
        .set({
          mercadoLibreAccessToken: newTokens.access_token,
          mercadoLibreRefreshToken: newTokens.refresh_token,
          mercadoLibreAccessTokenExpiresAt: newAccessTokenExpiresAt,
          mercadoLibreScopes: newTokens.scope || '',
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      await syncMercadoLibreScopes(userId, newTokens.access_token);
      logger.info('MercadoLibreAuth: Tokens refrescados y persistidos', { userId });

      return newTokens.access_token;
    } catch (error) {
      logger.error('MercadoLibreAuth: Error refrescando y persistiendo tokens', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      await db
        .update(users)
        .set({
          mercadoLibreAccessToken: null,
          mercadoLibreRefreshToken: null,
          mercadoLibreAccessTokenExpiresAt: null,
          mercadoLibreRefreshTokenExpiresAt: null,
          mercadoLibreScopes: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await markUserNeedsReauth(userId, 'token_expired');
      throw error;
    }
  }

  public async getAccessToken(): Promise<string> {
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

    if (user.mercadoLibreAccessTokenExpiresAt && new Date() > user.mercadoLibreAccessTokenExpiresAt) {
      if (user.mercadoLibreRefreshToken) {
        return this.refreshAndPersist(user.id, user.mercadoLibreRefreshToken);
      }
      throw new Error('Token de acceso expirado y no hay refresh token');
    }

    return user.mercadoLibreAccessToken;
  }

  public async refreshAccessToken(): Promise<string> {
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

    return this.refreshAndPersist(user.id, user.mercadoLibreRefreshToken);
  }
}
