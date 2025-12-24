import { NextRequest, NextResponse } from 'next/server';

import {
  getQuoteByCartId,
  getQuoteByKey,
} from '@/lib/services/tiendanube-shipping-quotes';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quoteKey = searchParams.get('quoteKey');
    const cartId = searchParams.get('cartId');

    if (!quoteKey && !cartId) {
      return NextResponse.json(
        { error: 'Debe indicar quoteKey o cartId' },
        { status: 400 }
      );
    }

    let quote = quoteKey ? await getQuoteByKey(quoteKey) : null;

    if (!quote && cartId) {
      quote = await getQuoteByCartId(cartId);
    }

    if (!quote) {
      return NextResponse.json(
        { error: 'No hay cotizaciones vigentes' },
        { status: 404 }
      );
    }

    const now = Date.now();
    const expiresAt = new Date(quote.expiresAt).getTime();
    const ttlSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));

    return NextResponse.json({
      cartId: quote.cartId,
      quoteKey: quote.quoteKey,
      destinationZip: quote.destinationZip,
      options: quote.options,
      source: quote.source,
      expiresAt: quote.expiresAt,
      ttlSeconds,
    });
  } catch (error) {
    console.error('[API Tiendanube GET] Error:', error);
    return NextResponse.json(
      { error: 'No se pudieron recuperar las opciones de envío.' },
      { status: 500 }
    );
  }
}
