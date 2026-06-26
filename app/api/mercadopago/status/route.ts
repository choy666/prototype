import { NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar si hay configuración de MercadoPago
    const mpPublicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    
    console.log('[MP Status] Verificando configuración:', {
      hasPublicKey: !!mpPublicKey,
      hasAccessToken: !!mpAccessToken,
      publicKeyPrefix: mpPublicKey ? mpPublicKey.substring(0, 20) : 'null'
    });
    
    const isConnected = Boolean(mpPublicKey && mpAccessToken);
    
    // Extraer el ID de cuenta del public key si está disponible
    let accountId = null;
    if (mpPublicKey) {
      // El formato del public key es: APP_USR-{uuid}
      const match = mpPublicKey.match(/APP_USR-(.+)/);
      if (match) {
        accountId = match[1];
      }
    }

    return NextResponse.json({
      connected: isConnected,
      userId: accountId,
      accessToken: Boolean(mpAccessToken),
      refreshToken: false, // MercadoPago no usa refresh token en la implementación actual
      publicKey: mpPublicKey ? `${mpPublicKey.substring(0, 20)}...` : null,
    });
    
  } catch (error) {
    console.error('[MP Status] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
