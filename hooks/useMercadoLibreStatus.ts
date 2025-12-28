'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface MercadoLibreModuleStatus {
  module: string;
  hasAllScopes: boolean;
  missingScopes: string[];
}

export interface MercadoLibreStatusData {
  connected: boolean;
  userId?: string;
  scopes?: string[];
  expiresAt?: string;
  hasCriticalScopes?: boolean;
  missingCriticalScopes?: string[];
  mlNeedsReauth?: boolean;
  mlReauthReason?: string | null;
  reason?: string;
  refreshed?: boolean;
  mlSiteId?: string | null;
  mlSellerId?: string | null;
  mlPermalink?: string | null;
  mlLevelId?: string | null;
  modules?: MercadoLibreModuleStatus[];
}

interface UseMercadoLibreStatusOptions {
  enabled?: boolean;
}

export function useMercadoLibreStatus(
  options: UseMercadoLibreStatusOptions = {},
) {
  const { enabled = true } = options;

  const [data, setData] = useState<MercadoLibreStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!enabled || !isMountedRef.current) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/mercadolibre/status');

      if (!response.ok) {
        if (response.status === 401) {
          if (isMountedRef.current) {
            setData({ connected: false });
          }
          return;
        }

        throw new Error('Request failed');
      }

      const json = (await response.json()) as MercadoLibreStatusData;

      if (isMountedRef.current) {
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching MercadoLibre status:', err);

      if (isMountedRef.current) {
        setError(
          err instanceof Error
            ? err
            : new Error('Error desconocido al obtener el estado de MercadoLibre'),
        );

        setData((prev) => prev ?? { connected: false });
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    fetchStatus();
  }, [enabled, fetchStatus]);

  return { data, isLoading, error, refetch: fetchStatus };
}
