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

    // Obtener el body raw para validar HMAC
    const body = await request.text();
    let parsedBody: TiendanubeWebhookRequest;
    
    try {
      parsedBody = JSON.parse(body);
    } catch (jsonError) {
      console.error('[Tiendanube Webhook] Invalid JSON body', jsonError);
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // TODO: Implementar validación HMAC SHA256
    // const secret = process.env.TIENDANUBE_WEBHOOK_SECRET;
    // const expectedSignature = crypto.createHmac('sha256', secret)
    //   .update(body)
    //   .digest('hex');
    // if (authHeader !== `sha256=${expectedSignature}`) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    console.log('[Tiendanube Webhook] Request data:', {
      cart_id: parsedBody.cart_id,
      store_id: parsedBody.store_id,
      destination: parsedBody.destination.postal_code,
      items_count: parsedBody.items.length
    });

    // Verificar que la tienda existe
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, parsedBody.store_id.toString()),
    });

    if (!store) {
      console.error('[Tiendanube Webhook] Store not found:', parsedBody.store_id);
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    // Calcular tarifas usando el servicio
    const options = await tiendanubeWebhookService.calculateShippingRates(parsedBody);
    
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
