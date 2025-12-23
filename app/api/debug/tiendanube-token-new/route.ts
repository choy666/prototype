import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decryptString } from '@/lib/utils/encryption';

export async function GET() {
  try {
    // Buscar el store actualizado (7089578)
    const store = await db.query.tiendanubeStores.findFirst({
      where: (stores, { eq }) => eq(stores.storeId, '7089578')
    });
    
    if (!store) {
      return NextResponse.json({ 
        error: 'Store 7089578 not found',
        allStores: 'Use /api/debug/all-stores to see all'
      });
    }

    const decryptedToken = decryptString(store.accessTokenEncrypted);
    
    return NextResponse.json({
      storeId: store.storeId,
      status: store.status,
      installedAt: store.installedAt,
      tokenInfo: {
        hasToken: !!store.accessTokenEncrypted,
        isPlaceholder: decryptedToken === 'encrypted_token_here',
        tokenLength: decryptedToken.length,
        tokenStart: decryptedToken.substring(0, 50) + '...',
        tokenEnd: '...' + decryptedToken.substring(decryptedToken.length - 50)
      },
      rawToken: process.env.NODE_ENV === 'development' ? decryptedToken : undefined
    });
  } catch (error) {
    console.error('[Debug New Token] Error:', error);
    return NextResponse.json({ 
      error: 'Error checking token',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
