import { NextRequest, NextResponse } from 'next/server';
import { unifiedShipping } from '@/lib/services/unified-shipping';

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

    // Calcular envío usando el servicio unificado
    const options = await unifiedShipping.calculateShipping({
      customerZip,
      items,
      subtotal
    });

    return NextResponse.json({ options });
  } catch (error) {
    console.error('[Unified Shipping] Error:', error);
    
    // No usar fallback estático - devolver error real
    return NextResponse.json(
      { error: 'No se pudieron calcular las opciones de envío. Intente nuevamente.' },
      { status: 500 }
    );
  }
}
