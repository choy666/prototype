import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { getTiendanubeConfig } from '@/lib/config/integrations';
import { encryptString } from '@/lib/utils/encryption';
import { logger } from '@/lib/utils/logger';
import { retryWithBackoff } from '@/lib/utils/retry';
import { TiendanubeClient } from '@/lib/clients/tiendanube';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

interface TiendanubeTokenData {
  access_token: string;
  token_type: string;
  scope?: string;
  user_id: string;
}

interface TiendanubeStoreInfo {
  id: number;
  name: { [lang: string]: string } | string;
  description?: { [lang: string]: string } | string | null;
  email: string;
  business_address?: {
    street?: string;
    number?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    country?: string;
  } | null;
  address?: {
    street?: string;
    number?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    country?: string;
  } | null;
  country: string;
  main_currency: string;
}

interface TiendanubeLocation {
  id: number;
  name: string;
  address: string;
  number?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
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

async function fetchAndStoreStoreInfo(storeId: string, accessToken: string): Promise<void> {
  try {
    const client = new TiendanubeClient({ storeId, accessToken });
    
    // Obtener información básica de la tienda
    const storeInfo = await client.get<TiendanubeStoreInfo>('/store');
    
    // Obtener ubicaciones de fulfillment
    const locations = await client.get<TiendanubeLocation[]>('/locations');
    
    // Extraer dirección de origen
    let originAddress = null;
    let originZipCode = null;
    
    // Usar business_address si está disponible
    if (storeInfo.business_address) {
      originAddress = storeInfo.business_address;
      originZipCode = storeInfo.business_address.zip_code;
    } else if (storeInfo.address) {
      originAddress = storeInfo.address;
      originZipCode = storeInfo.address.zip_code;
    } else if (locations && locations.length > 0) {
      // Usar la primera ubicación disponible
      const mainLocation = locations[0] as TiendanubeLocation & {
        zipcode?: string;
        postal_code?: string;
      };
      console.log('[TIENDANUBE] Primera ubicación:', mainLocation);
      
      originAddress = {
        street: mainLocation.address,
        number: mainLocation.number,
        city: mainLocation.city,
        state: mainLocation.state,
        zip_code: mainLocation.zip_code || mainLocation.zipcode || mainLocation.postal_code,
        country: mainLocation.country
      };
      originZipCode = mainLocation.zip_code || mainLocation.zipcode || mainLocation.postal_code;
    }

    // Actualizar la información en la base de datos
    await db
      .update(tiendanubeStores)
      .set({
        name: typeof storeInfo.name === 'string' ? storeInfo.name : storeInfo.name?.es || storeInfo.name?.['es'] || '',
        email: storeInfo.email,
        country: storeInfo.country,
        currency: storeInfo.main_currency,
        originAddress,
        originZipCode,
        locations,
        updatedAt: new Date(),
      })
      .where(eq(tiendanubeStores.storeId, storeId));

    logger.info('[TIENDANUBE] Información de tienda guardada', {
      storeId,
      name: typeof storeInfo.name === 'string' ? storeInfo.name : storeInfo.name?.es || storeInfo.name?.['es'] || '',
      country: storeInfo.country,
      currency: storeInfo.main_currency,
      hasOriginAddress: Boolean(originAddress),
      originZipCode,
      locationsCount: locations?.length || 0
    });
  } catch (error) {
    logger.error('[TIENDANUBE] Error obteniendo información de tienda', {
      storeId,
      error: error instanceof Error ? error.message : String(error)
    });
    // No fallamos el flujo si no podemos obtener la info
  }
}

async function registerCustomCarrier(storeId: string, accessToken: string): Promise<void> {
  try {
    const client = new TiendanubeClient({ storeId, accessToken });
    
    // Verificar si el carrier ya existe
    const existingCarriers = await client.getCarriers();
    const existingCarrier = existingCarriers.find((c: { code?: string }) => c.code === 'standard-shipping');
    
    if (existingCarrier) {
      logger.info('[TIENDANUBE] Carrier personalizado ya existe', { 
        storeId, 
        carrierId: existingCarrier.id 
      });
      return;
    }

    // Registrar nuevo carrier
    const carrierData = {
      name: 'Envío Estándar',
      code: 'standard-shipping',
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://localhost:3000'}/api/webhooks/tiendanube/shipping`,
      handling_fee: 0,
      active: true
    };

    const newCarrier = await client.registerCarrier(carrierData);
    logger.info('[TIENDANUBE] Carrier personalizado registrado exitosamente', { 
      storeId, 
      carrierId: newCarrier.id,
      carrierName: newCarrier.name
    });
  } catch (error) {
    logger.error('[TIENDANUBE] Error registrando carrier personalizado', {
      storeId,
      error: error instanceof Error ? error.message : String(error)
    });
    // No fallamos el flujo si el carrier no se puede registrar
  }
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

    // Obtener y guardar información adicional de la tienda
    await fetchAndStoreStoreInfo(storeId, tokenData.access_token);

    // Registrar carrier personalizado automáticamente si tenemos el scope write_shipping
    if (tokenData.scope?.includes('write_shipping')) {
      await registerCustomCarrier(storeId, tokenData.access_token);
    } else {
      logger.warn('[TIENDANUBE] Scope write_shipping no disponible, omitiendo registro de carrier', {
        storeId,
        scopes: tokenData.scope
      });
    }

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
