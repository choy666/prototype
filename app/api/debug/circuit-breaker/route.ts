import { NextRequest, NextResponse } from 'next/server';
import { 
  me2ShippingCircuitBreaker, 
  mercadoPagoCircuitBreaker, 
  categoriesCircuitBreaker 
} from '@/lib/utils/circuit-breaker';

interface CircuitBreakerStatsResponse {
  timestamp: string;
  services: {
    [serviceName: string]: {
      state: string;
      failureCount: number;
      successCount: number;
      lastFailureTime: number;
      timeSinceLastFailure: number;
      options: {
        failureThreshold: number;
        resetTimeout: number;
        monitoringPeriod: number;
        name: string;
      };
      health: 'healthy' | 'degraded' | 'failed';
    };
  };
  summary: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    failedServices: number;
  };
}

// Middleware de autenticación simple
function authenticate(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  const adminKey = process.env.ADMIN_API_KEY || 'dev-key-123';
  return apiKey === adminKey;
}

function getServiceHealth(stats: {
  state: string;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  timeSinceLastFailure: number;
  options: {
    failureThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
    name: string;
  };
}): 'healthy' | 'degraded' | 'failed' {
  if (stats.state === 'OPEN') return 'failed';
  if (stats.state === 'HALF_OPEN') return 'degraded';
  if (stats.failureCount > 0) return 'degraded';
  return 'healthy';
}

export async function GET(request: NextRequest) {
  try {
    // Autenticación
    if (!authenticate(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const timestamp = new Date().toISOString();

    // Obtener stats de todos los circuit breakers
    const me2Stats = me2ShippingCircuitBreaker.getStats();
    const mpStats = mercadoPagoCircuitBreaker.getStats();
    const categoriesStats = categoriesCircuitBreaker.getStats();

    const services = {
      'ME2-Shipping-API': {
        ...me2Stats,
        health: getServiceHealth(me2Stats)
      },
      'MercadoPago-API': {
        ...mpStats,
        health: getServiceHealth(mpStats)
      },
      'ML-Categories-API': {
        ...categoriesStats,
        health: getServiceHealth(categoriesStats)
      }
    };

    // Calcular resumen
    const healthValues = Object.values(services).map((s) => s.health);
    const summary = {
      totalServices: healthValues.length,
      healthyServices: healthValues.filter((h) => h === 'healthy').length,
      degradedServices: healthValues.filter((h) => h === 'degraded').length,
      failedServices: healthValues.filter((h) => h === 'failed').length
    };

    const response: CircuitBreakerStatsResponse = {
      timestamp,
      services,
      summary
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[DEBUG] Error obteniendo stats de circuit breaker:', error);
    return NextResponse.json({ 
      error: 'Error obteniendo stats de circuit breaker', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// Endpoint para reset manual (solo desarrollo)
export async function POST(request: NextRequest) {
  try {
    // Autenticación
    if (!authenticate(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Solo permitir reset en desarrollo
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ 
        error: 'Reset manual no permitido en producción' 
      }, { status: 403 });
    }

    const { service } = await request.json().catch(() => ({}));

    switch (service) {
      case 'me2':
        me2ShippingCircuitBreaker.reset();
        break;
      case 'mercadopago':
        mercadoPagoCircuitBreaker.reset();
        break;
      case 'categories':
        categoriesCircuitBreaker.reset();
        break;
      case 'all':
      default:
        me2ShippingCircuitBreaker.reset();
        mercadoPagoCircuitBreaker.reset();
        categoriesCircuitBreaker.reset();
        break;
    }

    return NextResponse.json({ 
      message: `Circuit breaker${service && service !== 'all' ? ` ${service}` : 's'} reseteado(s)`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[DEBUG] Error reseteando circuit breaker:', error);
    return NextResponse.json({ 
      error: 'Error reseteando circuit breaker', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
