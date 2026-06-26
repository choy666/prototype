export enum MercadoLibreErrorCode {
  // Errores de autenticación
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  AUTH_FAILED = 'AUTH_FAILED',
  
  // Errores de API
  API_RATE_LIMIT_EXCEEDED = 'API_RATE_LIMIT_EXCEEDED',
  API_UNAVAILABLE = 'API_UNAVAILABLE',
  INVALID_REQUEST = 'INVALID_REQUEST',
  SHIPPING_CALCULATION_FAILED = 'SHIPPING_CALCULATION_FAILED',
  CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND',
  
  // Errores de sincronización
  SYNC_FAILED = 'SYNC_FAILED',
  
  // Errores de validación
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',
  
  // Errores de conexión
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  
  // Errores de Circuit Breaker
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Errores internos
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface MercadoLibreErrorDetails {
  [key: string]: unknown;
}

export class MercadoLibreError extends Error {
  constructor(
    public code: MercadoLibreErrorCode,
    message: string,
    public details?: MercadoLibreErrorDetails
  ) {
    super(message);
    this.name = 'MercadoLibreError';
  }

  static fromError(error: Error | { response?: { data?: { error?: unknown; status?: number; message?: string } }; code?: string }): MercadoLibreError {
    if (error instanceof MercadoLibreError) {
      return error;
    }

    // Mapeo de errores de la API de MercadoLibre
    if ('response' in error && error.response?.data) {
      const { error: apiError, status, message } = error.response.data;
      
      if (status === 400) {
        return new MercadoLibreError(
          MercadoLibreErrorCode.INVALID_REQUEST,
          message || 'Solicitud inválida',
          apiError as MercadoLibreErrorDetails
        );
      }
      
      if (status === 401 || status === 403) {
        return new MercadoLibreError(
          MercadoLibreErrorCode.INVALID_CREDENTIALS,
          'Credenciales inválidas o expiradas',
          apiError as MercadoLibreErrorDetails
        );
      }
      
      if (status === 429) {
        return new MercadoLibreError(
          MercadoLibreErrorCode.API_RATE_LIMIT_EXCEEDED,
          'Límite de solicitudes excedido',
          apiError as MercadoLibreErrorDetails
        );
      }
      
      if (status && status >= 500) {
        return new MercadoLibreError(
          MercadoLibreErrorCode.API_UNAVAILABLE,
          'Error en el servidor de MercadoLibre',
          apiError as MercadoLibreErrorDetails
        );
      }
    }

    // Manejo de errores de red
    if ('code' in error && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')) {
      return new MercadoLibreError(
        MercadoLibreErrorCode.TIMEOUT_ERROR,
        'Tiempo de espera agotado al conectar con MercadoLibre',
        { code: error.code }
      );
    }

    // Error genérico
    return new MercadoLibreError(
      MercadoLibreErrorCode.UNKNOWN_ERROR,
      'Error desconocido al comunicarse con MercadoLibre',
      { 
        message: error instanceof Error ? error.message : 'Unknown error', 
        stack: error instanceof Error ? error.stack : undefined 
      }
    );
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details })
    };
  }
}

// Función de utilidad para lanzar errores de validación
export function throwValidationError(message: string, details?: MercadoLibreErrorDetails): never {
  throw new MercadoLibreError(
    MercadoLibreErrorCode.VALIDATION_ERROR,
    message,
    details
  );
}
