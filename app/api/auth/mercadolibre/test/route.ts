import { NextResponse } from 'next/server';
import { getTokens } from '@/lib/auth/mercadolibre';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { validateMercadoLibreConnectionStatus } from '@/lib/validations/mercadolibre';
import { fetchWithRetry } from '@/lib/utils/retry';
import { auth } from '@/lib/actions/auth';

export async function GET() {
  try {
    // Obtener tokens almacenados (requiere userId)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          error: 'Usuario no autenticado',
          connected: false 
        },
        { status: 401 }
      );
    }
    
    const tokens = await getTokens(parseInt(session.user.id));
    
    if (!tokens || !tokens.access_token) {
      return NextResponse.json(
        { 
          error: 'No hay tokens de acceso disponibles',
          connected: false 
        },
        { status: 401 }
      );
    }

    // Probar conexión haciendo una llamada a la API de MercadoLibre
    const testResponse = await fetchWithRetry(
      'https://api.mercadolibre.com/users/me',
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
      },
      {
        maxRetries: 2,
        initialDelay: 500,
      }
    );

    if (!testResponse.ok) {
      throw new MercadoLibreError(
        MercadoLibreErrorCode.API_UNAVAILABLE,
        `Error al probar conexión: ${testResponse.statusText}`,
        { status: testResponse.status }
      );
    }

    const userData = await testResponse.json();
    
    // Validar respuesta
    const validatedData = validateMercadoLibreConnectionStatus({
      connected: true,
      userId: userData.id?.toString(),
      scopes: [], // Los scopes no están disponibles directamente en tokens
      expiresAt: tokens.accessTokenExpiresAt ? tokens.accessTokenExpiresAt.toISOString() : undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Conexión con MercadoLibre exitosa',
      data: validatedData,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error probando conexión con MercadoLibre:', error);

    if (error instanceof MercadoLibreError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          connected: false,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Error genérico
    const mercadoLibreError = MercadoLibreError.fromError(error as Error);
    
    return NextResponse.json(
      {
        error: mercadoLibreError.message,
        code: mercadoLibreError.code,
        connected: false,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  // Alias para GET method para permitir pruebas desde formularios
  return GET();
}
