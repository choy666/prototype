// app/api/webhooks/tiendanube/shipping/route.ts
// Webhook para calcular tarifas de envío para Tiendanube

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { tiendanubeWebhookService, TiendanubeWebhookRequest } from '@/lib/services/tiendanube-webhook-service';

export async function POST(request: NextRequest) {
  try {
    console.log('[Tiendanube Webhook] Shipping request received');
    
    // Validar el header de autenticación de Tiendanube
    const authHeader = request.headers.get('x-tiendanube-signature');
    if (!authHeader) {
      console.error('[Tiendanube Webhook] Missing authentication header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parsear el body
    const body: TiendanubeWebhookRequest = await request.json();
    console.log('[Tiendanube Webhook] Request data:', {
      cart_id: body.cart_id,
      store_id: body.store_id,
      destination: body.destination.postal_code,
      items_count: body.items.length
    });

    // Verificar que la tienda existe
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, body.store_id.toString()),
    });

    if (!store) {
      console.error('[Tiendanube Webhook] Store not found:', body.store_id);
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    // Calcular tarifas usando el servicio
    const options = await tiendanubeWebhookService.calculateShippingRates(body);
    
    console.log('[Tiendanube Webhook] Calculated options:', options.length);
    
    return NextResponse.json({ options });
  } catch (error) {
    console.error('[Tiendanube Webhook] Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
