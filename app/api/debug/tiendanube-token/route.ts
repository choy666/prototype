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
    
    return NextResponse.json({
      storeId: store.storeId,
      status: store.status,
      hasToken: !!store.accessTokenEncrypted,
      tokenValue: decryptedToken.substring(0, 20) + '...', // Solo primeros 20 chars
      isPlaceholder: decryptedToken === 'encrypted_token_here'
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({ error: 'Error checking token' }, { status: 500 });
  }
}
