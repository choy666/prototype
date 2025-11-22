'use client';

import Link from 'next/link';
import { CheckCircle2, AlertCircle, Loader2, ShoppingBag, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { useMercadoLibreStatus } from '@/hooks/useMercadoLibreStatus';
import { useState, useEffect } from 'react';

interface SyncStatus {
  total: number;
  synced: number;
  pending: number;
  errors: number;
}

export function MercadoLibreStatus() {
  const { data, isLoading, error } = useMercadoLibreStatus();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  const isConnected = Boolean(data?.connected);
  const hasError = Boolean(error);

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <ShoppingBag className="mr-2 h-4 w-4" />
          Estado de MercadoLibre
        </CardTitle>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isConnected ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-yellow-500" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoading ? 'Cargando...' : isConnected ? 'Conectado' : 'Desconectado'}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {isConnected
            ? `Usuario: ${data?.userId || 'N/A'}`
            : hasError
            ? 'Error al obtener el estado de MercadoLibre'
            : 'No conectado a MercadoLibre'}
        </p>
        
        {/* Estado de sincronización */}
        {isConnected && syncStatus && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3 w-3 text-blue-500" />
              <span className="text-xs font-medium">Sincronización:</span>
              <Badge variant="outline" className="text-xs">
                {syncStatus.synced}/{syncStatus.total}
              </Badge>
            </div>
            
            {syncStatus.pending > 0 && (
              <div className="text-xs text-yellow-600">
                {syncStatus.pending} pendientes
              </div>
            )}
            
            {syncStatus.errors > 0 && (
              <div className="text-xs text-red-600">
                {syncStatus.errors} con errores
              </div>
            )}
          </div>
        )}
        <div className="mt-4">
          <Link href="/admin/mercadolibre">
            <Button variant="outline" size="sm" className="w-full">
              {isConnected ? 'Administrar' : 'Conectar'}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
