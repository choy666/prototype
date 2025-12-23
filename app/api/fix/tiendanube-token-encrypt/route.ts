import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { decryptString, encryptString } from '@/lib/utils/encryption';

export async function POST() {
  try {
    // Obtener el store actual
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, '7089578')
    });
    
    if (!store) {
      return NextResponse.json({ error: 'Store not found' });
    }

    // Verificar si el token está cifrado incorrectamente
    let accessToken: string;
    
    try {
      try {
        accessToken = decryptString(store.accessTokenEncrypted);
        console.log('[Fix] Token descifrado correctamente, longitud:', accessToken.length);
      } catch {
        console.log('[Fix] Error al descifrar, podría estar ya en texto plano');
        accessToken = store.accessTokenEncrypted;
      }
    } catch (error) {
      console.error('[Fix Token] Error:', error);
      return NextResponse.json(
        { error: 'Error al corregir token' },
        { status: 500 }
      );
    }

    // Verificar si el token funciona
    const testResponse = await fetch(`https://api.tiendanube.com/v1/7089578/`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      return NextResponse.json({
        error: 'Token inválido',
        status: testResponse.status,
        details: await testResponse.text()
      });
    }

    // Si funciona, guardar cifrado correctamente
    const encryptedToken = encryptString(accessToken);
    
    await db.update(tiendanubeStores)
      .set({
        accessTokenEncrypted: encryptedToken,
        status: 'connected',
        updatedAt: new Date()
      })
      .where(eq(tiendanubeStores.storeId, '7089578'));

    return NextResponse.json({
      message: 'Token corregido y guardado correctamente',
      tokenLength: accessToken.length,
      tokenStart: accessToken.substring(0, 20) + '...',
      testStatus: 'Token válido'
    });
  } catch (error) {
    console.error('[Fix Token] Error:', error);
    return NextResponse.json(
      { error: 'Error al corregir token' },
      { status: 500 }
    );
  }
}
