import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { getMercadoLibreScopes, validateMercadoLibreScopes, REQUIRED_SCOPES } from '@/lib/auth/mercadolibre';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id);

    // Obtener scopes disponibles
    const availableScopes = await getMercadoLibreScopes(userId);

    // Validar scopes por módulo
    const scopeValidation = {
      auth: await validateMercadoLibreScopes(userId, REQUIRED_SCOPES.auth),
      products: await validateMercadoLibreScopes(userId, REQUIRED_SCOPES.products),
      inventory: await validateMercadoLibreScopes(userId, REQUIRED_SCOPES.inventory),
      orders: await validateMercadoLibreScopes(userId, REQUIRED_SCOPES.orders),
      messages: await validateMercadoLibreScopes(userId, REQUIRED_SCOPES.messages),
    };

    // Calcular estado general
    const allRequiredScopes = Object.values(REQUIRED_SCOPES).flat();
    const overallValidation = await validateMercadoLibreScopes(userId, allRequiredScopes);

    const response = {
      success: true,
      data: {
        availableScopes,
        modules: scopeValidation,
        overall: {
          hasAllScopes: overallValidation.hasAllScopes,
          missingScopes: overallValidation.missingScopes,
        },
        lastChecked: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error obteniendo permisos de Mercado Libre:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        data: {
          availableScopes: [],
          modules: {},
          overall: {
            hasAllScopes: false,
            missingScopes: [],
          },
          lastChecked: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
