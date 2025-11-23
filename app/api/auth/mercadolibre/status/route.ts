import { NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { isTokenExpired, refreshAccessToken, checkCriticalScopes } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';

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
      },
    });

    if (!user || !user.mercadoLibreAccessToken) {
      logger.info('MercadoLibre Status: Usuario no conectado', { userId });
      return NextResponse.json({
        connected: false,
        reason: 'no_tokens'
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

        // Verificar scopes críticos después del refresh
        const scopeCheck = await checkCriticalScopes(userId);

        return NextResponse.json({
          connected: true,
          userId: user.mercadoLibreId,
          nickname: user.mlNickname,
          scopes: newTokens.scope ? newTokens.scope.split(' ') : [],
          expiresAt: newAccessTokenExpiresAt,
          refreshed: true,
          hasCriticalScopes: scopeCheck.hasCriticalScopes,
          missingCriticalScopes: scopeCheck.missingCriticalScopes,
        });

      } catch (refreshError) {
        logger.error('MercadoLibre Status: Error refrescando token', {
          userId,
          error: refreshError instanceof Error ? refreshError.message : String(refreshError)
        });

        // Si falla el refresh, marcar como desconectado
        const now = new Date();
        await db.update(users)
          .set({
            mercadoLibreAccessToken: null,
            mercadoLibreRefreshToken: null,
            mercadoLibreAccessTokenExpiresAt: null,
            mercadoLibreRefreshTokenExpiresAt: null,
            mercadoLibreScopes: null,
            updatedAt: now,
          })
          .where(eq(users.id, userId));

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

      return NextResponse.json({
        connected: false,
        reason: 'tokens_expired'
      });
    }

    // Verificar scopes críticos
    const scopeCheck = await checkCriticalScopes(userId);

    return NextResponse.json({
      connected: true,
      userId: user.mercadoLibreId,
      nickname: user.mlNickname,
      scopes: user.mercadoLibreScopes ? user.mercadoLibreScopes.split(' ') : [],
      expiresAt: user.mercadoLibreAccessTokenExpiresAt,
      refreshed: false,
      hasCriticalScopes: scopeCheck.hasCriticalScopes,
      missingCriticalScopes: scopeCheck.missingCriticalScopes,
    });

  } catch (error) {
    logger.error('MercadoLibre Status: Error verificando estado', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
