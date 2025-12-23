// app/api/shipping/tiendanube/route.ts
// Endpoint para calcular envíos con Envío Nube

import { NextRequest, NextResponse } from 'next/server';
import { tiendanubeShippingOnly } from '@/lib/services/tiendanube-shipping-only';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerZip, items, subtotal } = body;

    // Validaciones básicas
    if (!customerZip || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Datos incompletos para calcular envío' },
        { status: 400 }
      );
    }

    // Validar que cada item tenga peso y dimensiones
    const validatedItems = items.map(item => ({
      ...item,
      weight: item.weight || 0,
      dimensions: item.dimensions || { length: 0, width: 0, height: 0 }
    }));

    console.log('[API Tiendanube] Request:', {
      customerZip,
      itemCount: items.length,
      items: validatedItems.map(i => ({ 
        id: i.id, 
        weight: i.weight, 
        dimensions: i.dimensions 
      }))
    });

    // Calcular envío usando solo Tiendanube
    const options = await tiendanubeShippingOnly.calculateShipping({
      customerZip,
      items: validatedItems,
      subtotal
    });

    console.log('[API Tiendanube] Opciones devueltas:', options.length);

    return NextResponse.json({ options });
  } catch (error) {
    console.error('[API Tiendanube] Error:', error);
    
    return NextResponse.json(
      { error: 'No se pudieron calcular las opciones de envío. Intente nuevamente.' },
      { status: 500 }
    );
  }
}
