import { NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const userId = parseInt(session.user.id);

    if (isNaN(userId)) {
      return NextResponse.json({
        connected: false,
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        mercadoLibreId: true,
        mercadoLibreAccessToken: true,
        mercadoLibreRefreshToken: true,
        mercadoLibreAccessTokenExpiresAt: true,
        mercadoLibreScopes: true,
      },
    });

    if (!user || !user.mercadoLibreAccessToken) {
      return NextResponse.json({
        connected: false,
      });
    }

    return NextResponse.json({
      connected: true,
      userId: user.mercadoLibreId,
      scopes: user.mercadoLibreScopes ? user.mercadoLibreScopes.split(' ') : [],
      expiresAt: user.mercadoLibreAccessTokenExpiresAt,
    });
  } catch (error) {
    console.error('Error checking MercadoLibre status:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
