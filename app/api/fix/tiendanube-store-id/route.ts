import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shippingSettings } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    // Actualizar el store ID al correcto
    await db
      .update(shippingSettings)
      .set({ 
        tiendanubeStoreId: '7089578',
        tiendanubeEnabled: true,
        updatedAt: new Date()
      })
      .where(eq(shippingSettings.id, 1)); // Asumimos que solo hay un registro

    return NextResponse.json({
      success: true,
      message: 'Tiendanube store ID actualizado a 7089578',
      newConfig: {
        tiendanubeStoreId: '7089578',
        tiendanubeEnabled: true
      }
    });
  } catch (error) {
    console.error('[Fix] Error updating store ID:', error);
    return NextResponse.json({ error: 'Error updating store ID' }, { status: 500 });
  }
}
