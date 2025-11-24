import { NextResponse } from 'next/server';
import { MERCADOLIBRE_CONFIG } from '@/lib/auth/mercadolibre';

export async function GET() {
  try {
    console.log('🔍 Verificando credenciales de Mercado Libre...');
    console.log('Client ID:', MERCADOLIBRE_CONFIG.clientId);
    console.log('Redirect URI:', MERCADOLIBRE_CONFIG.redirectUri);
    
    // Probar obtener token de aplicación (client_credentials flow)
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: MERCADOLIBRE_CONFIG.clientId,
      client_secret: MERCADOLIBRE_CONFIG.clientSecret,
    });

    const response = await fetch(`${MERCADOLIBRE_CONFIG.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Error en credenciales:', error);
      return NextResponse.json({
        success: false,
        error: 'Error en credenciales',
        details: error,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const data = await response.json();
    console.log('✅ Credenciales válidas!');
    
    // Verificar scopes para ME2
    const requiredScopes = ['write', 'read'];
    const hasRequiredScopes = requiredScopes.every(scope => data.scope.includes(scope));
    
    const result = {
      success: true,
      credentials: {
        valid: true,
        accessTokenPreview: data.access_token.substring(0, 20) + '...',
        expiresIn: data.expires_in,
        scope: data.scope,
        hasRequiredScopes: hasRequiredScopes,
        requiredScopes: requiredScopes,
        missingScopes: requiredScopes.filter(scope => !data.scope.includes(scope))
      },
      timestamp: new Date().toISOString()
    };

    if (hasRequiredScopes) {
      console.log('✅ Scopes requeridos para ME2 presentes');
    } else {
      console.log('⚠️  Scopes requeridos para ME2 faltantes');
      console.log('Scopes actuales:', data.scope);
      console.log('Scopes requeridos:', requiredScopes);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error verificando credenciales:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
