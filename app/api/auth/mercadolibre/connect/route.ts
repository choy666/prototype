import { NextResponse } from 'next/server';
import { generateCodeVerifier, generateCodeChallenge, generateState, buildMercadoLibreAuthUrl } from '@/lib/auth/mercadolibre';
import { setCookieAsync } from '@/lib/utils/cookies';
import { auth } from '@/lib/actions/auth';
import { logger } from '@/lib/utils/logger';

export async function GET() {
  const session = await auth();
  
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    logger.info('MercadoLibre: Generando OAuth', {
      codeVerifierLength: codeVerifier.length,
      codeChallengeLength: codeChallenge.length,
      stateLength: state.length,
      state: state.substring(0, 8) + '...'
    });

    // Store code_verifier and state in HTTP-only cookie
    await setCookieAsync('mercadolibre_code_verifier', codeVerifier, {
      maxAge: 600, // 10 minutes
    });

    await setCookieAsync('mercadolibre_state', state, {
      maxAge: 600, // 10 minutos
    });

    logger.info('MercadoLibre: Cookies guardadas exitosamente', {
      codeVerifierSaved: true,
      stateSaved: true
    });

    // Build the authorization URL
    const authUrl = buildMercadoLibreAuthUrl({
      state,
      codeChallenge,
    });

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
