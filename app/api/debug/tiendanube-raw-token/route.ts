import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { decryptString } from '@/lib/utils/encryption';

export async function GET() {
  try {
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, '7089578')
    });
    
    if (!store) {
      return NextResponse.json({ error: 'Store not found' });
    }

    const rawToken = decryptString(store.accessTokenEncrypted);
    
    return NextResponse.json({
      storeId: store.storeId,
      rawToken: rawToken, // Solo en development
      tokenLength: rawToken.length,
      tokenType: typeof rawToken,
      looksLikeJWT: rawToken.startsWith('eyJ'),
      looksLikeBase64: /^[A-Za-z0-9+/=]+$/.test(rawToken),
      installedAt: store.installedAt
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Error decrypting token',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}
