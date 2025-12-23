import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';

export async function POST() {
  try {
    // Verificar si ya existe una tienda
    const existing = await db.query.tiendanubeStores.findFirst({
      where: (stores, { eq }) => eq(stores.storeId, '7078702')
    });
    
    if (existing) {
      return NextResponse.json({ 
        message: 'La tienda Tiendanube ya existe',
        data: { storeId: existing.storeId }
      });
    }

    // Insertar tienda de ejemplo (deberías usar el access token real)
    const [newStore] = await db.insert(tiendanubeStores).values({
      storeId: '7078702',
      accessTokenEncrypted: 'encrypted_token_here', // Deberías encriptar el token real
      status: 'connected',
      lastSyncAt: new Date(),
    }).returning();

    return NextResponse.json({ 
      message: 'Tienda Tiendanube configurada correctamente',
      data: newStore 
    });
  } catch (error) {
    console.error('[Seed] Error:', error);
    return NextResponse.json(
      { error: 'Error al configurar tienda Tiendanube' },
      { status: 500 }
    );
  }
}
