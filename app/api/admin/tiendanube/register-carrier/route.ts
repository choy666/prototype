// app/api/admin/tiendanube/register-carrier/route.ts
// Endpoint para registrar un carrier personalizado en Tiendanube

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { decryptString } from '@/lib/utils/encryption';

interface RegisterCarrierRequest {
  name: string;
  code: string;
  callback_url: string;
  handling_fee?: number;
  active?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterCarrierRequest = await request.json();
    const { name, code, callback_url, handling_fee = 0, active = true } = body;

    // Validaciones
    if (!name || !code || !callback_url) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, code, callback_url' },
        { status: 400 }
      );
    }

    // Obtener tienda de Tiendanube
    const settings = await db.query.shippingSettings.findFirst();
    if (!settings?.tiendanubeStoreId) {
      return NextResponse.json(
        { error: 'Tiendanube no está configurado' },
        { status: 400 }
      );
    }

    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, settings.tiendanubeStoreId),
    });

    if (!store) {
      return NextResponse.json(
        { error: 'Tienda de Tiendanube no encontrada' },
        { status: 404 }
      );
    }

    // Crear carrier en Tiendanube
    const carrierData = {
      name,
      code,
      callback_url,
      handling_fee,
      active
    };

    const response = await fetch(
      `https://api.tiendanube.com/2025-03/${settings.tiendanubeStoreId}/shipping_carriers`,
      {
        method: 'POST',
        headers: {
          'Authentication': `bearer ${decryptString(store.accessTokenEncrypted)}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Technocat-Integration/1.0 (contact@technocat.com)'
        },
        body: JSON.stringify(carrierData)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Tiendanube] Error registering carrier:', error);
      return NextResponse.json(
        { error: `Error al registrar carrier: ${error}` },
        { status: response.status }
      );
    }

    const carrier = await response.json();
    console.log('[Tiendanube] Carrier registered successfully:', carrier.id);

    return NextResponse.json({
      success: true,
      carrier: {
        id: carrier.id,
        name: carrier.name,
        code: carrier.code,
        callback_url: carrier.callback_url
      }
    });
  } catch (error) {
    console.error('[Tiendanube] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
