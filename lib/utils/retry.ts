/**
 * Utilidad para reintentos con backoff exponencial
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: Error | { response?: { status?: number }; code?: string }) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = defaultShouldRetry
  } = options;

  let lastError: Error | { response?: { status?: number }; code?: string } = new Error('Unknown error');
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error | { response?: { status?: number }; code?: string };

      // Si es el último intento o no se debe reintentar, lanzar el error
      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      // Esperar antes del siguiente reintento
      await sleep(delay);
      
      // Incrementar delay con backoff exponencial
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
}

function defaultShouldRetry(error: Error | { response?: { status?: number }; code?: string }): boolean {
  // Reintentar en errores de red, timeouts y rate limiting
  if ('code' in error && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')) {
    return true;
  }
  
  if ('response' in error && error.response?.status === 429) {
    return true;
  }
  
  if ('response' in error && error.response?.status && error.response.status >= 500) {
    return true;
  }
  
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Función de conveniencia para llamadas a API con reintentos
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions?: RetryOptions
): Promise<Response> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & { response: { status: number; statusText: string } };
        error.response = {
          status: response.status,
          statusText: response.statusText
        };
        throw error;
      }
      
      return response;
    },
    retryOptions
  );
}
