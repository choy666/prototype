import { NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Desconectar todas las tiendas del usuario
    await db.update(tiendanubeStores)
      .set({ 
        status: 'disconnected',
        uninstalledAt: new Date(),
        accessTokenEncrypted: '' // Usar string vacío en lugar de null por restricción .notNull()
      })
      .where(eq(tiendanubeStores.status, 'connected'));

    return NextResponse.json({ 
      success: true,
      message: 'Tienda desconectada exitosamente'
    });

  } catch (error) {
    console.error('[TIENDANUBE] Error al desconectar:', error);
    return NextResponse.json(
      { error: 'Error al desconectar la tienda' },
      { status: 500 }
    );
  }
}
