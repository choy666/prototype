import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decryptString } from '@/lib/utils/encryption';

export async function GET() {
  try {
    // Obtener la tienda conectada
    const store = await db.query.tiendanubeStores.findFirst({
      where: (stores, { eq }) => eq(stores.storeId, '7089578')
    });
    
    if (!store) {
      return NextResponse.json({ error: 'Store not found' });
    }

    const token = decryptString(store.accessTokenEncrypted);
    
    // Obtener carriers configurados
    const carriersResponse = await fetch(
      `https://api.tiendanube.com/v1/7089578/shipping_carriers`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!carriersResponse.ok) {
      return NextResponse.json({
        error: `Error fetching carriers: ${carriersResponse.status}`,
        details: await carriersResponse.text()
      }, { status: 400 });
    }

    const carriers = await carriersResponse.json();
    
    return NextResponse.json({
      storeId: '7089578',
      carriers,
      count: carriers.length
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({ 
      error: 'Error checking carriers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
