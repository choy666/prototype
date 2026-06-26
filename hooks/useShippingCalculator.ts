import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/utils/logger';

export interface ShippingItem {
  id: string;
  quantity: number;
  price: number;
  mlItemId?: string;
  weight?: number;
  dimensions?: {
    height: number;
    width: number;
    length: number;
  };
}

export interface ShippingOptions {
  name: string;
  cost: number;
  estimated: string;
}

export interface ShippingCalculationResponse {
  success: boolean;
  options: ShippingOptions[];
  source?: string;
  fallback?: boolean;
  warnings?: string[];
  metadata?: {
    calculationSource?: string;
    calculationHash?: string;
    timestamp?: string;
  };
  requestId?: string;
  message?: string;
}

export interface UseShippingCalculatorProps {
  debounceMs?: number;
  onCalculationComplete?: (result: ShippingCalculationResponse) => void;
  onError?: (error: string) => void;
}

export interface UseShippingCalculatorReturn {
  calculateShipping: (zipcode: string, items: ShippingItem[]) => Promise<ShippingCalculationResponse | null>;
  isLoading: boolean; // API call en progreso
  isCalculating: boolean; // Incluyendo debounce
  result: ShippingCalculationResponse | null;
  error: string | null;
  clearError: () => void;
  clearResult: () => void;
}

// Hook personalizado para cálculo de envío con debounce y requestId
export function useShippingCalculator({
  debounceMs = 400,
  onCalculationComplete,
  onError,
}: UseShippingCalculatorProps = {}): UseShippingCalculatorReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<ShippingCalculationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const debounceTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const lastRequestIdRef = useRef<string | null>(null);
  const pendingRequestRef = useRef<string | null>(null);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Generar requestId único
  const generateRequestId = useCallback(() => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Guardar requestId en localStorage para debugging
  const saveRequestId = useCallback((requestId: string, zipcode: string, items: ShippingItem[]) => {
    try {
      const key = `shipping_request_${requestId}`;
      const data = {
        requestId,
        zipcode,
        items,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(data));
      
      // Limpiar requests antiguos (más de 1 hora)
      const cutoff = Date.now() - (60 * 60 * 1000);
      Object.keys(localStorage)
        .filter(key => key.startsWith('shipping_request_'))
        .forEach(key => {
          try {
            const stored = JSON.parse(localStorage.getItem(key) || '{}');
            if (stored.timestamp && new Date(stored.timestamp).getTime() < cutoff) {
              localStorage.removeItem(key);
            }
          } catch {
            // Ignorar errores al limpiar
          }
        });
    } catch (storageError) {
      // No fallar si localStorage no está disponible
      logger.warn('Error guardando requestId en localStorage', {
        requestId,
        error: storageError instanceof Error ? storageError.message : String(storageError)
      });
    }
  }, []);

  // Función principal de cálculo con debounce
  const calculateShipping = useCallback(async (
    zipcode: string,
    items: ShippingItem[]
  ): Promise<ShippingCalculationResponse | null> => {
    // Validaciones básicas
    if (!zipcode || zipcode.length < 4) {
      const errorMsg = 'Código postal inválido';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    }

    if (!items || items.length === 0) {
      const errorMsg = 'Se requiere al menos un producto';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    }

    // Generar hash para detectar solicitudes duplicadas
    const requestHash = `${zipcode}-${items.map(i => `${i.id}:${i.quantity}`).sort().join('-')}`;
    
    // Si es la misma solicitud que la pendiente, ignorar
    if (pendingRequestRef.current === requestHash) {
      logger.info('Solicitud duplicada detectada, ignorando', { requestHash });
      return result;
    }

    // Limpiar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Iniciar estado de cálculo (incluyendo debounce)
    setIsCalculating(true);
    setError(null);

    return new Promise((resolve) => {
      debounceTimerRef.current = window.setTimeout(async () => {
        // Verificar que el componente siga montado
        if (!isMountedRef.current) {
          resolve(null);
          return;
        }

        // Marcar como solicitud pendiente
        pendingRequestRef.current = requestHash;
        
        // Generar requestId
        const requestId = generateRequestId();
        lastRequestIdRef.current = requestId;

        // Guardar para debugging
        saveRequestId(requestId, zipcode, items);

        logger.info('Iniciando cálculo de envío', {
          requestId,
          zipcode,
          itemCount: items.length,
          requestHash
        });

        try {
          setIsLoading(true);

          // Llamar a la API
          const response = await fetch('/api/shipments/calculate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              zipcode,
              items,
              requestId,
              allowFallback: true,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error || `Error ${response.status}: ${response.statusText}`;
            
            logger.error('Error en API de envío', {
              requestId,
              status: response.status,
              error: errorMsg,
              errorData
            });
            
            throw new Error(errorMsg);
          }

          const data: ShippingCalculationResponse = await response.json();
          
          // Verificar que el requestId coincida (evitar respuestas antiguas)
          if (data.requestId && data.requestId !== requestId) {
            logger.warn('Respuesta con requestId diferente, ignorando', {
              expectedRequestId: requestId,
              receivedRequestId: data.requestId
            });
            resolve(result); // Retornar resultado existente
            return;
          }

          logger.info('Cálculo de envío completado', {
            requestId,
            source: data.source,
            fallback: data.fallback,
            optionsCount: data.options?.length || 0,
            warningsCount: data.warnings?.length || 0,
            calculationSource: data.metadata?.calculationSource
          });

          // Actualizar estado
          if (isMountedRef.current) {
            setResult(data);
            setError(null);
            onCalculationComplete?.(data);
          }

          resolve(data);

        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
          
          logger.error('Error en cálculo de envío', {
            requestId,
            error: errorMsg,
            stack: err instanceof Error ? err.stack : undefined
          });

          if (isMountedRef.current) {
            setError(errorMsg);
            setResult(null);
            onError?.(errorMsg);
          }

          resolve(null);

        } finally {
          // Limpiar estados
          if (isMountedRef.current) {
            setIsLoading(false);
            setIsCalculating(false);
          }
          pendingRequestRef.current = null;
        }
      }, debounceMs);
    });
  }, [
    debounceMs,
    result,
    generateRequestId,
    saveRequestId,
    onCalculationComplete,
    onError
  ]);

  // Funciones utilitarias
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
    setIsCalculating(false);
    pendingRequestRef.current = null;
  }, []);

  return {
    calculateShipping,
    isLoading,
    isCalculating,
    result,
    error,
    clearError,
    clearResult,
  };
}
