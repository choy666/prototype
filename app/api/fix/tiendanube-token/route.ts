import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    // Eliminar stores antiguos o con tokens inválidos
    await db.delete(tiendanubeStores)
      .where(eq(tiendanubeStores.storeId, '7070702'));

    // Verificar store actual
    const currentStore = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, '7089578')
    });

    if (!currentStore) {
      return NextResponse.json({
        message: 'No hay tienda conectada. Por favor, conéctese desde /admin/tiendanube'
      });
    }

    return NextResponse.json({
      message: 'Token limpio. Listo para reconectar.',
      storeId: currentStore.storeId,
      hasToken: !!currentStore.accessTokenEncrypted
    });
  } catch (error) {
    console.error('[Fix Token] Error:', error);
    return NextResponse.json(
      { error: 'Error al limpiar token' },
      { status: 500 }
    );
  }
}
