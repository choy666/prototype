import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { getTiendanubeConfig } from '@/lib/config/integrations';
import { encryptString } from '@/lib/utils/encryption';
import { logger } from '@/lib/utils/logger';
import { retryWithBackoff } from '@/lib/utils/retry';

export const runtime = 'nodejs';

interface TiendanubeTokenData {
  access_token: string;
  token_type: string;
  scope?: string;
  user_id: string;
}

async function exchangeCodeForToken(code: string): Promise<TiendanubeTokenData> {
  const config = getTiendanubeConfig();

  if (!config.appId || !config.clientSecret || !config.authBase) {
    throw new Error('Tiendanube no configurado (faltan TIENDANUBE_APP_ID/TIENDANUBE_CLIENT_SECRET/TIENDANUBE_AUTH_BASE)');
  }

  const tokenUrl = `${config.authBase}/apps/authorize/token`;
  const maxRetries = Math.max(0, config.retryAttempts - 1);

  return retryWithBackoff(
    async () => {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: config.appId,
          client_secret: config.clientSecret,
          grant_type: 'authorization_code',
          code,
        }),
        signal: AbortSignal.timeout(config.timeout),
      });

      const text = await res.text();
      let json: unknown = {};

      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text };
        }
      }

      if (!res.ok) {
        const err = new Error(`Error en token (${res.status}): ${text}`) as Error & {
          response?: { status?: number };
        };
        err.response = { status: res.status };
        throw err;
      }

      return json as TiendanubeTokenData;
    },
    {
      maxRetries,
      initialDelay: config.retryDelay,
      maxDelay: config.retryDelay * 10,
    }
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const storedState = request.cookies.get('tiendanube_state')?.value;

  logger.info('[TIENDANUBE] Callback recibido', {
    hasCode: Boolean(code),
    hasState: Boolean(state),
    hasStoredState: Boolean(storedState),
    hasError: Boolean(error),
    error,
  });

  if (error) {
    const response = NextResponse.redirect(
      new URL(
        `/admin/tiendanube?error=oauth_failed&message=${encodeURIComponent(errorDescription || error)}`,
        request.url
      )
    );
    response.cookies.delete('tiendanube_state');
    return response;
  }

  if (!state || !storedState || state !== storedState) {
    const response = NextResponse.redirect(new URL('/admin/tiendanube?error=invalid_state', request.url));
    response.cookies.delete('tiendanube_state');
    return response;
  }

  if (!code) {
    const response = NextResponse.redirect(new URL('/admin/tiendanube?error=no_code', request.url));
    response.cookies.delete('tiendanube_state');
    return response;
  }

  try {
    const tokenData = await exchangeCodeForToken(code);

    const now = new Date();
    const storeId = tokenData.user_id;

    await db
      .insert(tiendanubeStores)
      .values({
        storeId,
        accessTokenEncrypted: encryptString(tokenData.access_token),
        scopes: tokenData.scope || null,
        status: 'connected',
        installedAt: now,
        uninstalledAt: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: tiendanubeStores.storeId,
        set: {
          accessTokenEncrypted: encryptString(tokenData.access_token),
          scopes: tokenData.scope || null,
          status: 'connected',
          installedAt: now,
          uninstalledAt: null,
          updatedAt: now,
        },
      });

    logger.info('[TIENDANUBE] Tokens guardados exitosamente', {
      storeId,
      hasScope: Boolean(tokenData.scope),
    });

    const response = NextResponse.redirect(
      new URL(`/admin/tiendanube?auth=success&connected=tiendanube&storeId=${encodeURIComponent(storeId)}`, request.url)
    );
    response.cookies.delete('tiendanube_state');
    return response;
  } catch (err) {
    logger.error('[TIENDANUBE] Error procesando callback', {
      error: err instanceof Error ? err.message : String(err),
    });

    const response = NextResponse.redirect(
      new URL(
        `/admin/tiendanube?error=token_exchange_failed&message=${encodeURIComponent(err instanceof Error ? err.message : 'Error desconocido')}`,
        request.url
      )
    );
    response.cookies.delete('tiendanube_state');
    return response;
  }
}
