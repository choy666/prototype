import { NextResponse } from 'next/server';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/lib/auth/mercadolibre';
import { setCookieAsync } from '@/lib/utils/cookies';
import { auth } from '@/lib/actions/auth';

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

    // Store code_verifier and state in HTTP-only cookie
    await setCookieAsync('mercadolibre_code_verifier', codeVerifier, {
      maxAge: 600, // 10 minutes
    });

    await setCookieAsync('mercadolibre_state', state, {
      maxAge: 600, // 10 minutos
    });

    // Build the authorization URL
    const authUrl = new URL('https://auth.mercadolibre.com.ar/authorization');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', process.env.MERCADOLIBRE_CLIENT_ID!);
    authUrl.searchParams.append('redirect_uri', process.env.MERCADOLIBRE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/mercadolibre/callback`);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('state', state);

    // Add required scopes
    const scopes = [
      'read_orders', 'write_products', 'read_products', 'offline_access',
      'read_inventory', 'write_inventory', 'read_shipping', 'write_shipping',
      'read_user_email', 'read_user_profile'
    ];
    
    authUrl.searchParams.append('scope', scopes.join(' '));

    return NextResponse.json({ url: authUrl.toString() });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
