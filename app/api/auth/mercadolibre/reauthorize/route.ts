import { NextResponse } from 'next/server';

import { auth } from '@/lib/actions/auth';
import {
  buildMercadoLibreAuthUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  markUserNeedsReauth,
} from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';
import { setCookieAsync } from '@/lib/utils/cookies';

export async function POST() {
  const session = await auth();

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const userId = Number(session.user.id);

    if (Number.isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID de usuario inválido' },
        { status: 400 },
      );
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    await setCookieAsync('mercadolibre_code_verifier', codeVerifier, {
      maxAge: 600,
      httpOnly: true,
      sameSite: 'lax',
    });

    await setCookieAsync('mercadolibre_state', state, {
      maxAge: 600,
      httpOnly: true,
      sameSite: 'lax',
    });

    await markUserNeedsReauth(userId, 'manual', { preserveTokens: true });

    const authUrl = buildMercadoLibreAuthUrl({
      state,
      codeChallenge,
    });

    logger.info('MercadoLibre: Reautorización solicitada', {
      userId,
      reason: 'manual',
    });

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    logger.error('MercadoLibre: Error iniciando reautorización', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error desconocido iniciando reautorización',
      },
      { status: 500 },
    );
  }
}
