import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { createTiendanubeShippingClient } from '@/lib/clients/tiendanube-shipping';
import { decryptString } from '@/lib/utils/encryption';

export async function POST(request: Request) {
  try {
    const { customerZip, items, subtotal } = await request.json();
    
    console.log('[Test Tiendanube] Starting test with:', { customerZip, items, subtotal });
    
    // 1. Obtener settings
    const settings = await db.query.shippingSettings.findFirst();
    console.log('[Test Tiendanube] Settings:', {
      tiendanubeEnabled: settings?.tiendanubeEnabled,
      tiendanubeStoreId: settings?.tiendanubeStoreId,
      businessZipCode: settings?.businessZipCode
    });
    
    // 2. Obtener tienda
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, settings?.tiendanubeStoreId || ''),
    });
    
    console.log('[Test Tiendanube] Store found:', !!store);
    
    if (!store) {
      return NextResponse.json({ error: 'Tiendanube store not found' }, { status: 404 });
    }
    
    // 3. Crear cliente
    const client = createTiendanubeShippingClient({
      storeId: settings!.tiendanubeStoreId!,
      accessToken: decryptString(store.accessTokenEncrypted)
    });
    
    // 4. Calcular envío
    const totalWeight = items.reduce((sum: number, item: { weight?: number; quantity: number }) => 
      sum + (item.weight || 0) * item.quantity, 0);
    const maxDimensions = items.reduce((max: { length: number; width: number; height: number }, 
      item: { dimensions?: { length: number; width: number; height: number } }) => {
      if (!item.dimensions) return max;
      return {
        length: Math.max(max.length, item.dimensions.length),
        width: Math.max(max.width, item.dimensions.width),
        height: Math.max(max.height, item.dimensions.height)
      };
    }, { length: 0, width: 0, height: 0 });
    
    const shippingParams = {
      origin_zip: settings!.businessZipCode,
      destination_zip: customerZip,
      weight: totalWeight,
      height: maxDimensions.height || undefined,
      width: maxDimensions.width || undefined,
      length: maxDimensions.length || undefined,
      declared_value: subtotal
    };
    
    console.log('[Test Tiendanube] Calling API with params:', shippingParams);
    
    const options = await client.calculateShipping(shippingParams);
    
    console.log('[Test Tiendanube] Success! Options:', options.length);
    
    return NextResponse.json({
      success: true,
      options,
      count: options.length
    });
    
  } catch (error) {
    console.error('[Test Tiendanube] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 });
  }
}
