import { NextRequest, NextResponse } from 'next/server';

// Token de admin simple para pruebas (en producción usar sistema más robusto)
const ADMIN_TEST_TOKEN = process.env.MIGRATION_ADMIN_TOKEN || 'migration-admin-2024-secure-token';

interface HealthResponse {
  status: string;
  timestamp: string;
  environment: 'development' | 'production' | 'test';
  tokenRequired: boolean;
  tokenConfigured: boolean;
  tokenLength: number;
  endpoints: {
    verifyCredentials: string;
    auditProducts: string;
    testShipping: string;
    health: string;
  };
  tokenValid?: boolean; // Opcional, solo cuando se verifica token
}


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const checkToken = searchParams.get('checkToken');
    
    // Si se solicita verificar token, incluirlo en la respuesta
    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      tokenRequired: true,
      tokenConfigured: !!process.env.MIGRATION_ADMIN_TOKEN,
      tokenLength: ADMIN_TEST_TOKEN.length,
      endpoints: {
        verifyCredentials: '/api/admin/verify-ml-credentials (no auth required)',
        auditProducts: '/api/admin/audit-products (no auth required)',
        testShipping: '/api/admin/test-shipping (auth required)',
        health: '/api/admin/health (no auth required)'
      }
    };

    // Si se solicita verificar token, validarlo
    if (checkToken) {
      response.tokenValid = checkToken === ADMIN_TEST_TOKEN;
    }

    return NextResponse.json(response);
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
