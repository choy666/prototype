
// Forzar el uso de Node.js Runtime para esta ruta
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getToken } from '@/lib/mercadolibre';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;

  if (!code || state !== storedState) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const tokens = await getToken(code);
    // Guarda el token en cookies
    cookieStore.set('ml_token', tokens.access_token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 semana
      path: '/',
    });
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
