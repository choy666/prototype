import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { createTiendanubeShippingClient } from '@/lib/clients/tiendanube-shipping';
import { decryptString } from '@/lib/utils/encryption';

export async function GET() {
  try {
    // Obtener settings
    const settings = await db.query.shippingSettings.findFirst();
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, settings?.tiendanubeStoreId || ''),
    });
    
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    
    // Crear cliente
    const client = createTiendanubeShippingClient({
      storeId: settings!.tiendanubeStoreId,
      accessToken: decryptString(store.accessTokenEncrypted)
    });
    
    // Obtener carriers disponibles
    const carriers = await client.getCarriers();
    
    return NextResponse.json({
      storeId: settings!.tiendanubeStoreId,
      carriers,
      count: carriers.length
    });
    
  } catch (error) {
    console.error('[Test Carriers] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
