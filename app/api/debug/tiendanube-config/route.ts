import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    // 1. Obtener shipping settings
    const shippingSettings = await db.query.shippingSettings.findFirst();
    
    // 2. Obtener tienda Tiendanube configurada
    const tiendaStore = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, shippingSettings?.tiendanubeStoreId || '')
    });
    
    // 3. Verificar si hay token
    let hasToken = false;
    let tokenLength = 0;
    
    if (tiendaStore?.accessTokenEncrypted) {
      try {
        const { decryptString } = await import('@/lib/utils/encryption');
        const token = decryptString(tiendaStore.accessTokenEncrypted);
        hasToken = true;
        tokenLength = token.length;
      } catch (error) {
        console.error('[Debug] Error decrypting token:', error);
      }
    }
    
    return NextResponse.json({
      shippingSettings: {
        tiendanubeEnabled: shippingSettings?.tiendanubeEnabled,
        tiendanubeStoreId: shippingSettings?.tiendanubeStoreId,
        businessZipCode: shippingSettings?.businessZipCode
      },
      tiendaStore: {
        exists: !!tiendaStore,
        storeId: tiendaStore?.storeId,
        status: tiendaStore?.status,
        hasToken,
        tokenLength
      },
      issues: [
        !shippingSettings?.tiendanubeEnabled && 'Tiendanube está deshabilitado en shipping settings',
        !shippingSettings?.tiendanubeStoreId && 'No hay Tiendanube store ID configurado',
        !tiendaStore && `No se encontró tienda con ID ${shippingSettings?.tiendanubeStoreId}`,
        !hasToken && 'La tienda no tiene token válido',
        tiendaStore?.status !== 'connected' && 'La tienda no está conectada'
      ].filter(Boolean)
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({ error: 'Error fetching config' }, { status: 500 });
  }
}
