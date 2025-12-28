import { NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import {
  isTokenExpired,
  refreshAccessToken,
  markUserNeedsReauth,
  syncMercadoLibreScopes,
  CRITICAL_SCOPES,
  REQUIRED_SCOPES,
} from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';

const parseScopes = (value?: string | null): string[] =>
  value
    ? value
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
    : [];

const buildScopeModules = (availableScopes: string[]) =>
  Object.entries(REQUIRED_SCOPES).map(([module, requiredScopes]) => {
    const missingScopes = requiredScopes.filter((scope) => !availableScopes.includes(scope));
    return {
      module,
      hasAllScopes: missingScopes.length === 0,
      missingScopes,
    };
  });

const evaluateScopes = (availableScopes: string[]) => {
  const modules = buildScopeModules(availableScopes);
  const missingCriticalScopes = CRITICAL_SCOPES.filter((scope) => !availableScopes.includes(scope));
  return {
    modules,
    missingCriticalScopes,
    hasCriticalScopes: missingCriticalScopes.length === 0,
  };
};

export async function GET() {
  const session = await auth();
  
  if (!session) {
    logger.warn('MercadoLibre Status: Usuario no autenticado');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const userId = parseInt(session.user.id);

    if (isNaN(userId)) {
      logger.warn('MercadoLibre Status: ID de usuario inválido', { userId: session.user.id });
      return NextResponse.json({
        connected: false,
        error: 'ID de usuario inválido'
      });
    }

    logger.info('MercadoLibre Status: Verificando estado de conexión', { userId });

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        mercadoLibreId: true,
        mercadoLibreAccessToken: true,
        mercadoLibreRefreshToken: true,
        mercadoLibreAccessTokenExpiresAt: true,
        mercadoLibreRefreshTokenExpiresAt: true,
        mercadoLibreScopes: true,
        mlNickname: true,
        mlNeedsReauth: true,
        mlReauthReason: true,
        mlSiteId: true,
        mlSellerId: true,
        mlPermalink: true,
        mlLevelId: true,
      },
    });

    if (!user || !user.mercadoLibreAccessToken) {
      logger.info('MercadoLibre Status: Usuario no conectado', { userId });
      return NextResponse.json({
        connected: false,
        reason: 'no_tokens',
        mlNeedsReauth: user?.mlNeedsReauth ?? false,
        mlReauthReason: user?.mlReauthReason ?? null,
        missingCriticalScopes: [],
        hasCriticalScopes: false,
        modules: [],
      });
    }

    // Verificar expiración del access token
    const isAccessTokenExpired = isTokenExpired(user.mercadoLibreAccessTokenExpiresAt);
    const isRefreshTokenExpired = isTokenExpired(user.mercadoLibreRefreshTokenExpiresAt);

    logger.info('MercadoLibre Status: Estado de tokens', {
      userId,
      isAccessTokenExpired,
      isRefreshTokenExpired,
      accessTokenExpiresAt: user.mercadoLibreAccessTokenExpiresAt,
      refreshTokenExpiresAt: user.mercadoLibreRefreshTokenExpiresAt
    });

    // Si el access token está expirado pero el refresh token es válido, intentar refrescar
    if (isAccessTokenExpired && !isRefreshTokenExpired && user.mercadoLibreRefreshToken) {
      try {
        logger.info('MercadoLibre Status: Intentando refrescar access token', { userId });
        
        const newTokens = await refreshAccessToken(user.mercadoLibreRefreshToken);
        
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

        logger.info('MercadoLibre Status: Access token refrescado exitosamente', {
          userId,
          newExpiresAt: newAccessTokenExpiresAt
        });

        const syncedScopes = await syncMercadoLibreScopes(userId, newTokens.access_token);
        const availableScopes =
          (syncedScopes && syncedScopes.length > 0 ? syncedScopes : parseScopes(newTokens.scope)) ||
          [];
        const scopeState = evaluateScopes(availableScopes);

        return NextResponse.json({
          connected: true,
          userId: user.mercadoLibreId,
          nickname: user.mlNickname,
          scopes: availableScopes,
          mlSiteId: user.mlSiteId,
          mlSellerId: user.mercadoLibreId,
          mlPermalink: user.mlPermalink,
          mlLevelId: user.mlLevelId,
          expiresAt: newAccessTokenExpiresAt,
          refreshed: true,
          hasCriticalScopes: scopeState.hasCriticalScopes,
          missingCriticalScopes: scopeState.missingCriticalScopes,
          modules: scopeState.modules,
        });

      } catch (refreshError) {
        logger.error('MercadoLibre Status: Error refrescando token', {
          userId,
          error: refreshError instanceof Error ? refreshError.message : String(refreshError)
        });

        // Si falla el refresh, marcar como desconectado
        await markUserNeedsReauth(userId, 'refresh_failed');

        return NextResponse.json({
          connected: false,
          reason: 'refresh_failed',
          error: refreshError instanceof Error ? refreshError.message : 'Error refrescando token'
        });
      }
    }

    // Si ambos tokens están expirados
    if (isRefreshTokenExpired) {
      logger.info('MercadoLibre Status: Refresh token expirado', { userId });
      
      // Limpiar tokens expirados
        await markUserNeedsReauth(userId, 'token_expired');

      return NextResponse.json({
        connected: false,
        reason: 'tokens_expired'
      });
    }

    const storedScopes = parseScopes(user.mercadoLibreScopes);
    const scopeState = evaluateScopes(storedScopes);

    return NextResponse.json({
      connected: true,
      userId: user.mercadoLibreId,
      nickname: user.mlNickname,
      scopes: storedScopes,
      expiresAt: user.mercadoLibreAccessTokenExpiresAt,
      refreshed: false,
      hasCriticalScopes: scopeState.hasCriticalScopes,
      missingCriticalScopes: scopeState.missingCriticalScopes,
      mlNeedsReauth: user.mlNeedsReauth || !scopeState.hasCriticalScopes,
      mlReauthReason: user.mlReauthReason,
      mlSiteId: user.mlSiteId,
      mlSellerId: user.mercadoLibreId,
      mlPermalink: user.mlPermalink,
      mlLevelId: user.mlLevelId,
      modules: scopeState.modules,
    });

  } catch (error) {
    logger.error('MercadoLibre Status: Error verificando estado', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
