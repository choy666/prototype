import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shippingSettings } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    // Actualizar shipping_settings con el nuevo store ID
    const [updated] = await db.update(shippingSettings)
      .set({
        tiendanubeStoreId: '7089578',
        tiendanubeEnabled: true,
        updatedAt: new Date()
      })
      .where(eq(shippingSettings.id, 1))
      .returning();

    return NextResponse.json({
      message: 'Store ID actualizado correctamente',
      storeId: updated.tiendanubeStoreId
    });
  } catch (error) {
    console.error('[Update Store] Error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar store ID' },
      { status: 500 }
    );
  }
}
