// app/api/shipping/tiendanube/route.ts
// Endpoint para calcular envíos con Envío Nube

import { NextRequest, NextResponse } from 'next/server';
import { createTiendanubeShippingClient, TiendanubeShippingParams } from '@/lib/clients/tiendanube-shipping';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { decryptString } from '@/lib/utils/encryption';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { zipCode, items, subtotal } = body;

    // Validaciones
    if (!zipCode || !items) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos: zipCode, items' },
        { status: 400 }
      );
    }

    // Calcular peso y dimensiones totales
    const totalWeight = items.reduce((sum: number, item: { weight?: number; quantity: number }) => sum + (item.weight || 0) * item.quantity, 0);
    const maxDimensions = items.reduce((max: { length: number; width: number; height: number }, item: { dimensions?: { length: number; width: number; height: number } }) => {
      if (!item.dimensions) return max;
      return {
        length: Math.max(max.length, item.dimensions.length),
        width: Math.max(max.width, item.dimensions.width),
        height: Math.max(max.height, item.dimensions.height)
      };
    }, { length: 0, width: 0, height: 0 });

    const shippingParams: TiendanubeShippingParams = {
      origin_zip: '1001', // CP del negocio
      destination_zip: zipCode,
      weight: totalWeight,
      height: maxDimensions.height || undefined,
      width: maxDimensions.width || undefined,
      length: maxDimensions.length || undefined,
      declared_value: subtotal || 0
    };
    
    // Usar la tienda conectada (7078702)
    const storeId = '7078702';
    
    // Obtener access token
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, storeId),
    });

    if (!store) {
      return NextResponse.json(
        { error: 'Tienda no conectada' },
        { status: 400 }
      );
    }

    // Crear cliente y calcular
    const client = createTiendanubeShippingClient({
      storeId,
      accessToken: decryptString(store.accessTokenEncrypted)
    });

    const options = await client.calculateShipping(shippingParams);

    return NextResponse.json({
      success: true,
      options: options.map((opt: {
        id: string;
        name: string;
        price: number;
        deliveryTime: string;
        carrier: string;
      }) => ({
        id: opt.id,
        name: opt.name,
        cost: opt.price,
        estimated: opt.deliveryTime
      }))
    });

  } catch (error) {
    console.error('[API] Tiendanube shipping error:', error);
    return NextResponse.json(
      { error: 'Error al calcular envío' },
      { status: 500 }
    );
  }
}
