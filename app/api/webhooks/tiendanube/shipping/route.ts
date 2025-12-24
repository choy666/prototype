// app/api/webhooks/tiendanube/shipping/route.ts
// Webhook para calcular tarifas de envío para Tiendanube

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { tiendanubeWebhookService, TiendanubeWebhookRequest } from '@/lib/services/tiendanube-webhook-service';
import { buildQuoteKey, saveQuote } from '@/lib/services/tiendanube-shipping-quotes';

export async function POST(request: NextRequest) {
  try {
    console.log('[Tiendanube Webhook] Shipping request received');
    
    const authHeader = request.headers.get('x-tiendanube-signature');

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

    const secret = process.env.TIENDANUBE_WEBHOOK_SECRET;
    if (secret) {
      if (!authHeader) {
        console.error('[Tiendanube Webhook] Missing authentication header');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const expectedSignature = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
      const receivedSignature = authHeader.includes('=')
        ? authHeader.split('=')[1]
        : authHeader;

      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const receivedBuffer = Buffer.from(receivedSignature, 'hex');

      if (
        expectedBuffer.length !== receivedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
      ) {
        console.error('[Tiendanube Webhook] Invalid signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

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

    const signatureItems = parsedBody.items.map((item) => ({
      id: item.product_id ?? item.id,
      grams: item.grams,
      quantity: item.quantity,
      price: item.price,
    }));

    const quoteKey = buildQuoteKey({
      storeId: parsedBody.store_id.toString(),
      destinationZip: parsedBody.destination.postal_code,
      items: signatureItems,
    });

    await saveQuote({
      storeId: parsedBody.store_id.toString(),
      cartId: parsedBody.cart_id,
      destinationZip: parsedBody.destination.postal_code,
      payload: parsedBody,
      options,
      quoteKey,
      source: 'tiendanube',
    });
    
    return NextResponse.json({ options });
  } catch (error) {
    console.error('[Tiendanube Webhook] Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
