import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { logger } from '@/lib/utils/logger';

export interface CircuitBreakerOptions {
  failureThreshold?: number;      // Número de fallos antes de abrir el circuito
  resetTimeout?: number;          // Tiempo en ms antes de intentar resetear
  monitoringPeriod?: number;      // Período de monitoreo en ms
  name?: string;                  // Nombre para logs
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Funcionamiento normal
  OPEN = 'OPEN',         // Circuito abierto, rechaza llamadas
  HALF_OPEN = 'HALF_OPEN' // Semi-abierto, permite algunas llamadas para probar
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000, // 1 minuto
      monitoringPeriod: options.monitoringPeriod || 300000, // 5 minutos
      name: options.name || 'CircuitBreaker'
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Verificar estado del circuito
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        logger.info(`[CircuitBreaker] ${this.options.name}: Cambiando a HALF_OPEN para probar recuperación`);
      } else {
        const error = new MercadoLibreError(
          MercadoLibreErrorCode.CIRCUIT_BREAKER_OPEN,
          `Circuit breaker ${this.options.name} está OPEN. Rechazando llamada.`,
          { 
            state: this.state, 
            failureCount: this.failureCount,
            timeUntilReset: this.options.resetTimeout - (Date.now() - this.lastFailureTime)
          }
        );
        logger.warn(`[CircuitBreaker] ${this.options.name}: Llamada rechazada - circuito abierto`, {
          failureCount: this.failureCount,
          timeSinceLastFailure: Date.now() - this.lastFailureTime,
          resetTimeout: this.options.resetTimeout
        });
        throw error;
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 2) { // 2 éxitos consecutivos para cerrar
        this.state = CircuitBreakerState.CLOSED;
        logger.info(`[CircuitBreaker] ${this.options.name}: Cerrado después de ${this.successCount} éxitos consecutivos`);
      }
    }
  }

  private onFailure(error: Error): void {
    // Verificar si el error debe ser ignorado por el circuit breaker
    if ((error as MercadoLibreError & { skipCircuitBreaker?: boolean }).skipCircuitBreaker) {
      logger.info(`[CircuitBreaker] ${this.options.name}: Error ignorado por skipCircuitBreaker flag`, {
        errorType: error.constructor.name,
        message: error.message
      });
      return;
    }

    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Volver a abrir si falla en HALF_OPEN
      this.state = CircuitBreakerState.OPEN;
      logger.warn(`[CircuitBreaker] ${this.options.name}: Volviendo a OPEN - fallo en HALF_OPEN`);
    } else if (this.failureCount >= this.options.failureThreshold) {
      // Abrir circuito si se alcanza el umbral de fallos
      this.state = CircuitBreakerState.OPEN;
      logger.error(`[CircuitBreaker] ${this.options.name}: Abierto - umbral de fallos alcanzado`, {
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold
      });
    }
  }

  private shouldAttemptReset(): boolean {
    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure >= this.options.resetTimeout;
  }

  // Métodos para monitoreo
  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure: Date.now() - this.lastFailureTime,
      options: this.options
    };
  }

  // Forzar reset (para pruebas o recuperación manual)
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    logger.info(`[CircuitBreaker] ${this.options.name}: Reset manual forzado`);
  }
}

// Circuit breakers específicos para diferentes servicios
export const me2ShippingCircuitBreaker = new CircuitBreaker({
  name: 'ME2-Shipping-API',
  failureThreshold: 3,
  resetTimeout: 30000, // 30 segundos
  monitoringPeriod: 120000 // 2 minutos
});

export const mercadoPagoCircuitBreaker = new CircuitBreaker({
  name: 'MercadoPago-API',
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minuto
  monitoringPeriod: 300000 // 5 minutos
});

export const categoriesCircuitBreaker = new CircuitBreaker({
  name: 'ML-Categories-API',
  failureThreshold: 4,
  resetTimeout: 45000, // 45 segundos
  monitoringPeriod: 180000 // 3 minutos
});

// Wrapper genérico para usar circuit breaker con cualquier operación
export function withCircuitBreaker<T>(
  circuitBreaker: CircuitBreaker,
  operation: () => Promise<T>
): Promise<T> {
  return circuitBreaker.execute(operation);
}
