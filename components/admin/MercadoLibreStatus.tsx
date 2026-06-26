'use client';

import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShoppingBag,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { useMercadoLibreStatus } from '@/hooks/useMercadoLibreStatus';
import { useState, useEffect, useCallback } from 'react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';

interface SyncStatus {
  total: number;
  synced: number;
  pending: number;
  errors: number;
}

export function MercadoLibreStatus() {
  const { data, isLoading, error, refetch } = useMercadoLibreStatus();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isReauthorizing, setIsReauthorizing] = useState(false);
  const { toast } = useToast();

  const isConnected = Boolean(data?.connected);
  const hasError = Boolean(error);
  const needsReauth = Boolean(data?.mlNeedsReauth);
  const missingCritical = data?.missingCriticalScopes ?? [];
  const modules = data?.modules ?? [];

  useEffect(() => {
    if (isConnected) {
      fetchSyncStatus();
    }
  }, [isConnected]);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/mercadolibre/sync/status');
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Error obteniendo estado de sincronización:', error);
    }
  };

  const handleReauthorize = useCallback(async () => {
    setIsReauthorizing(true);
    try {
      const response = await fetch('/api/auth/mercadolibre/reauthorize', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('No se pudo iniciar la reautorización');
      }

      const { url } = (await response.json()) as { url: string };

      toast({
        title: 'Redirigiendo a Mercado Libre',
        description: 'Termina el flujo de autorización para restaurar los permisos.',
      });

      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (reauthError) {
      toast({
        title: 'Error reautenticando',
        description:
          reauthError instanceof Error
            ? reauthError.message
            : 'No se pudo iniciar la reautorización',
        variant: 'destructive',
      });
    } finally {
      setIsReauthorizing(false);
      void refetch();
    }
  }, [refetch, toast]);

  const hasScopeIssues =
    needsReauth || missingCritical.length > 0 || modules.some((m) => !m.hasAllScopes);

  return (
    <Card className='h-full'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium flex items-center'>
          <ShoppingBag className='mr-2 h-4 w-4' />
          Estado de MercadoLibre
        </CardTitle>
        {isLoading ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : isConnected ? (
          <CheckCircle2 className='h-4 w-4 text-green-500' />
        ) : (
          <AlertCircle className='h-4 w-4 text-yellow-500' />
        )}
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>
          {isLoading ? 'Cargando...' : isConnected ? 'Conectado' : 'Desconectado'}
        </div>
        <p className='text-xs text-muted-foreground mt-1'>
          {isConnected
            ? `Usuario: ${data?.userId || 'N/A'}`
            : hasError
              ? 'Error al obtener el estado de MercadoLibre'
              : 'No conectado a MercadoLibre'}
        </p>

        {hasScopeIssues && (
          <div className='mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900'>
            <div className='flex items-center gap-2 font-semibold'>
              <ShieldAlert className='h-4 w-4' />
              Permisos incompletos
            </div>
            <p className='mt-1'>
              Reautoriza la integración para recuperar los permisos faltantes antes de publicar o
              sincronizar productos.
            </p>
            {missingCritical.length > 0 && (
              <div className='mt-2'>
                <p className='font-medium'>Scopes críticos faltantes:</p>
                <div className='mt-1 flex flex-wrap gap-1'>
                  {missingCritical.map((scope) => (
                    <Badge key={scope} variant='destructive'>
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estado de sincronización */}
        {isConnected && syncStatus && (
          <div className='mt-1 space-y-2'>
            <Separator />
            <div className='flex items-center gap-2 text-xs font-medium'>
              <RefreshCw className='h-3 w-3 text-blue-500' />
              Sincronización
              <Badge variant='outline' className='text-xs'>
                {syncStatus.synced}/{syncStatus.total}
              </Badge>
            </div>
          </div>
        )}

        <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2'>
          <Link href='/admin/mercadolibre'>
            <Button variant='outline' size='sm' className='w-full'>
              {isConnected ? 'Administrar' : 'Conectar'}
            </Button>
          </Link>
          <Button
            size='sm'
            className='w-full'
            variant={needsReauth ? 'destructive' : 'secondary'}
            onClick={handleReauthorize}
            disabled={isReauthorizing}
          >
            {isReauthorizing ? 'Redirigiendo…' : 'Reautorizar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
