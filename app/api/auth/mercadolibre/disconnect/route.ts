import { NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  const session = await auth();
  
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Clear all MercadoLibre related fields for the user
    const userId = parseInt(session.user.id);
    if (isNaN(userId)) {
      return new NextResponse('Invalid user ID', { status: 400 });
    }

    await db
      .update(users)
      .set({
        mercadoLibreId: null,
        mercadoLibreAccessToken: null,
        mercadoLibreRefreshToken: null,
        mercadoLibreScopes: null,
        mercadoLibreAccessTokenExpiresAt: null,
        mercadoLibreRefreshTokenExpiresAt: null,
      })
      .where(eq(users.id, userId));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error disconnecting from MercadoLibre:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
