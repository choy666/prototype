import { NextResponse } from 'next/server';

import { getTiendanubeConfig } from '@/lib/config/integrations';
import { auth } from '@/lib/actions/auth';
import { generateState } from '@/lib/auth/mercadolibre';
import { setCookieAsync } from '@/lib/utils/cookies';
import { logger } from '@/lib/utils/logger';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (!session || session.user.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const config = getTiendanubeConfig();

  if (!config.appId || !config.authBase) {
    logger.error('[TIENDANUBE] Configuración incompleta para OAuth', {
      hasAppId: Boolean(config.appId),
      hasAuthBase: Boolean(config.authBase),
    });
    return new NextResponse('Tiendanube no configurado', { status: 500 });
  }

  const state = generateState();

  await setCookieAsync('tiendanube_state', state, {
    maxAge: 600,
    sameSite: 'lax',
  });

  const authUrl = new URL(`${config.authBase}/apps/${config.appId}/authorize`);
  authUrl.searchParams.set('state', state);

  logger.info('[TIENDANUBE] OAuth iniciado', {
    state: `${state.substring(0, 8)}...`,
  });

  return NextResponse.json({ url: authUrl.toString() });
}
