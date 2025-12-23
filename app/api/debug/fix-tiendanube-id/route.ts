import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shippingSettings } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    // Actualizar el store ID al correcto
    const result = await db
      .update(shippingSettings)
      .set({ 
        tiendanubeStoreId: '7089578',
        tiendanubeEnabled: true,
        updatedAt: new Date()
      })
      .where(eq(shippingSettings.id, 1))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Tiendanube store ID actualizado a 7089578',
      updated: result
    });
  } catch (error) {
    console.error('[Fix] Error updating store ID:', error);
    return NextResponse.json({ error: 'Error updating store ID' }, { status: 500 });
  }
}
