import { NextResponse } from 'next/server';
import { 
  me2ShippingCircuitBreaker, 
  mercadoPagoCircuitBreaker, 
  categoriesCircuitBreaker 
} from '@/lib/utils/circuit-breaker';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'healthy' | 'unhealthy';
    circuitBreakers: {
      me2Shipping: 'healthy' | 'degraded' | 'failed';
      mercadoPago: 'healthy' | 'degraded' | 'failed';
      categories: 'healthy' | 'degraded' | 'failed';
    };
  };
  uptime: number;
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

function getOverallHealth(services: HealthResponse['services']): 'healthy' | 'degraded' | 'unhealthy' {
  // Si cualquier servicio está unhealthy, el sistema está unhealthy
  if (services.database === 'unhealthy' || 
      services.circuitBreakers.me2Shipping === 'failed' ||
      services.circuitBreakers.mercadoPago === 'failed' ||
      services.circuitBreakers.categories === 'failed') {
    return 'unhealthy';
  }
  
  // Si cualquier servicio está degraded, el sistema está degraded
  if (services.circuitBreakers.me2Shipping === 'degraded' ||
      services.circuitBreakers.mercadoPago === 'degraded' ||
      services.circuitBreakers.categories === 'degraded') {
    return 'degraded';
  }
  
  return 'healthy';
}

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Verificar conexión a base de datos
    let databaseHealth: 'healthy' | 'unhealthy' = 'healthy';
    try {
      // Usar raw SQL para verificar conexión sin depender de tablas específicas
      await db.execute(sql`SELECT 1`);
    } catch (error) {
      console.error('[Health] Database connection failed:', error);
      databaseHealth = 'unhealthy';
    }

    // Verificar estado de circuit breakers
    const me2Stats = me2ShippingCircuitBreaker.getStats();
    const mpStats = mercadoPagoCircuitBreaker.getStats();
    const categoriesStats = categoriesCircuitBreaker.getStats();

    const services = {
      database: databaseHealth,
      circuitBreakers: {
        me2Shipping: getServiceHealth(me2Stats),
        mercadoPago: getServiceHealth(mpStats),
        categories: getServiceHealth(categoriesStats)
      }
    };

    const overallHealth = getOverallHealth(services);
    const responseTime = Date.now() - startTime;

    const healthResponse: HealthResponse = {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      services,
      uptime: responseTime
    };

    // Retornar código HTTP basado en salud general
    const statusCode = overallHealth === 'healthy' ? 200 : 
                      overallHealth === 'degraded' ? 200 : 503;

    return NextResponse.json(healthResponse, { status: statusCode });

  } catch (error) {
    console.error('[Health] Health check failed:', error);
    
    const errorResponse: HealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unhealthy',
        circuitBreakers: {
          me2Shipping: 'failed',
          mercadoPago: 'failed',
          categories: 'failed'
        }
      },
      uptime: Date.now() - startTime
    };

    return NextResponse.json(errorResponse, { status: 503 });
  }
}
