'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertCircle, TestTube, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { LoadingBar } from '@/components/ui/loading-bar';
import { useMercadoLibreStatus } from '@/hooks/useMercadoLibreStatus';

interface SyncStatus {
  total: number;
  synced: number;
  pending: number;
  errors: number;
  lastSync?: string;
}

export function MercadoLibreConnection() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  const {
    data: connectionStatus,
    isLoading: isStatusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useMercadoLibreStatus();

  useEffect(() => {
    if (statusError) {
      toast.error('Error al verificar la conexión con MercadoLibre');
    }
  }, [statusError]);

  useEffect(() => {
    if (connectionStatus?.connected) {
      fetchSyncStatus();
    }
  }, [connectionStatus?.connected]);

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

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/mercadolibre/sync/all', {
        method: 'POST',
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Sincronización completada: ${result.synced} productos sincronizados`);
        await fetchSyncStatus();
      } else {
        toast.error(result.error || 'Error en la sincronización');
      }
    } catch (error) {
      console.error('Error en sincronización:', error);
      toast.error('Error al sincronizar productos');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      // Start the OAuth flow by redirecting to our API endpoint
      const response = await fetch('/api/auth/mercadolibre/connect');
      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No se pudo iniciar el proceso de conexión');
      }
    } catch (error) {
      console.error('Error initiating OAuth flow:', error);
      toast.error('Error al intentar conectar con MercadoLibre');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      const response = await fetch('/api/auth/mercadolibre/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Desconectado de MercadoLibre correctamente');
        await refetchStatus();
        router.refresh();
      } else {
        throw new Error('Error al desconectar');
      }
    } catch (error) {
      console.error('Error disconnecting from MercadoLibre:', error);
      toast.error('Error al desconectar de MercadoLibre');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      const response = await fetch('/api/auth/mercadolibre/test', {
        method: 'GET',
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success('Conexión con MercadoLibre verificada correctamente');
      } else {
        toast.error(data.error || 'Error al probar la conexión');
      }
    } catch (error) {
      console.error('Error testing MercadoLibre connection:', error);
      toast.error('Error al probar la conexión con MercadoLibre');
    } finally {
      setIsTesting(false);
    }
  };

  if (isStatusLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2">Cargando estado de conexión...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LoadingBar isLoading={isConnecting || isTesting || isSyncing} />
      
      <div className="border-b pb-4">
        <h2 className="text-xl font-semibold">Estado de la conexión</h2>
        <div className="mt-2 flex items-center">
          {connectionStatus?.connected ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
              <span>Conectado a MercadoLibre</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
              <span>No conectado a MercadoLibre</span>
            </>
          )}
        </div>
      </div>

      {connectionStatus?.connected ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">ID de usuario</h3>
            <p className="text-sm text-muted-foreground">
              {connectionStatus.userId || 'No disponible'}
            </p>
          </div>
          
          <div>
            <h3 className="font-medium">Permisos otorgados</h3>
            {connectionStatus.scopes && connectionStatus.scopes.length > 0 ? (
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                {connectionStatus.scopes.map((scope) => (
                  <li key={scope}>{scope}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No hay permisos disponibles</p>
            )}
          </div>
          
          <div>
            <h3 className="font-medium">Expiración del token</h3>
            <p className="text-sm text-muted-foreground">
              {connectionStatus.expiresAt 
                ? new Date(connectionStatus.expiresAt).toLocaleString() 
                : 'No disponible'}
            </p>
          </div>

          <div className="pt-4 space-y-2">
            <Button 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={isTesting || !connectionStatus?.connected}
              className="w-full"
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Probando conexión...
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  Probar conexión
                </>
              )}
            </Button>
            
            <Button 
              variant="destructive" 
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="w-full"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Desconectar cuenta'
              )}
            </Button>
          </div>

          {/* Estado de Sincronización */}
          {syncStatus && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Estado de Sincronización
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{syncStatus.total}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{syncStatus.synced}</div>
                    <div className="text-sm text-muted-foreground">Sincronizados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{syncStatus.pending}</div>
                    <div className="text-sm text-muted-foreground">Pendientes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{syncStatus.errors}</div>
                    <div className="text-sm text-muted-foreground">Errores</div>
                  </div>
                </div>

                {syncStatus.lastSync && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Última sincronización: {new Date(syncStatus.lastSync).toLocaleString()}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSyncAll}
                    disabled={isSyncing || syncStatus.pending === 0}
                    className="flex-1"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sincronizar Pendientes ({syncStatus.pending})
                      </>
                    )}
                  </Button>
                  
                  <Button variant="outline" onClick={fetchSyncStatus}>
                    Actualizar
                  </Button>
                </div>

                {syncStatus.errors > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-800">
                      {syncStatus.errors} productos con errores de sincronización
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="pt-4">
          <Button 
            onClick={handleConnect}
            disabled={isConnecting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Conectando...
              </>
            ) : (
              'Conectar con MercadoLibre'
            )}
          </Button>
          <p className="mt-2 text-sm text-muted-foreground">
            Serás redirigido a MercadoLibre para autorizar la conexión
          </p>
        </div>
      )}
    </div>
  );
}
