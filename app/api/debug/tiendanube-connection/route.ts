import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decryptString } from '@/lib/utils/encryption';

export async function GET() {
  try {
    const store = await db.query.tiendanubeStores.findFirst({
      where: (stores, { eq }) => eq(stores.storeId, '7078702')
    });
    
    if (!store) {
      return NextResponse.json({ error: 'Store not found' });
    }

    const decryptedToken = decryptString(store.accessTokenEncrypted);
    
    // Intentar hacer una llamada simple a la API para verificar el token
    let tokenValid = false;
    let apiError = null;
    
    try {
      const response = await fetch(`https://api.tiendanube.com/v1/${store.storeId}/store`, {
        headers: {
          'Authorization': `Bearer ${decryptedToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      tokenValid = response.ok;
      if (!response.ok) {
        apiError = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (error) {
      apiError = error instanceof Error ? error.message : 'Unknown error';
    }

    return NextResponse.json({
      storeId: store.storeId,
      status: store.status,
      lastSyncAt: store.lastSyncAt,
      tokenInfo: {
        hasToken: !!store.accessTokenEncrypted,
        isPlaceholder: decryptedToken === 'encrypted_token_here',
        tokenLength: decryptedToken.length,
        tokenStart: decryptedToken.substring(0, 20) + '...'
      },
      connectionTest: {
        tokenValid,
        apiError
      }
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({ error: 'Error checking connection' }, { status: 500 });
  }
}
