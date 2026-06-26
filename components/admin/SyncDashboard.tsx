'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { 
  RefreshCw, 
  Play, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Trash2,
  RotateCcw,
  BarChart3
} from 'lucide-react';

interface QueueStats {
  pending: number;
  syncing: number;
  synced: number;
  error: number;
  retrying: number;
  total: number;
}

interface BatchResults {
  processed: number;
  successful: number;
  failed: number;
}

export default function SyncDashboard() {
  const [stats, setStats] = useState<QueueStats>({
    pending: 0,
    syncing: 0,
    synced: 0,
    error: 0,
    retrying: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastResults, setLastResults] = useState<BatchResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cargar estadísticas iniciales
  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/mercadolibre/sync/queue?action=stats');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error cargando estadísticas');
      }
      
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Procesar un lote
  const processBatch = async () => {
    try {
      setProcessing(true);
      setError(null);
      
      const response = await fetch('/api/mercadolibre/sync/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'process' }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error procesando lote');
      }
      
      setLastResults(data.results);
      
      // Recargar estadísticas
      await loadStats();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setProcessing(false);
    }
  };

  // Reintentar items fallidos
  const retryFailed = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/mercadolibre/sync/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'retry' }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error reintentando items');
      }
      
      // Recargar estadísticas
      await loadStats();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Limpiar items antiguos
  const cleanupOld = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/mercadolibre/sync/queue?action=cleanup&days=30', {
        method: 'GET',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error limpiando items antiguos');
      }
      
      // Recargar estadísticas
      await loadStats();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas al montar el componente
  useEffect(() => {
    loadStats();
    
    // Configurar recarga automática cada 30 segundos
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calcular progreso general
  const totalProcessed = stats.synced + stats.error;
  const progressPercentage = stats.total > 0 ? (totalProcessed / stats.total) * 100 : 0;


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Sincronización</h1>
          <p className="text-muted-foreground">
            Monitorea y gestiona la cola de sincronización con Mercado Libre
          </p>
        </div>
        <Button onClick={loadStats} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sincronizando</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.syncing}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.synced}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Error</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.error}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reintentando</CardTitle>
            <RotateCcw className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.retrying}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <BarChart3 className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
      </div>

      {/* Progreso general */}
      <Card>
        <CardHeader>
          <CardTitle>Progreso General</CardTitle>
          <CardDescription>
            {totalProcessed} de {stats.total} productos procesados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>{progressPercentage.toFixed(1)}% completado</p>
            <p>{stats.synced} exitosos, {stats.error} con error</p>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <Tabs defaultValue="actions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="actions">Acciones</TabsTrigger>
          <TabsTrigger value="results">Últimos Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Acciones de Control</CardTitle>
              <CardDescription>
                Gestiona la cola de sincronización manualmente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={processBatch} 
                  disabled={processing || stats.pending === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {processing ? 'Procesando...' : 'Procesar Lote'}
                </Button>

                <Button 
                  onClick={retryFailed} 
                  disabled={loading || stats.error === 0}
                  variant="outline"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reintentar Fallidos ({stats.error})
                </Button>

                <Button 
                  onClick={cleanupOld} 
                  disabled={loading || stats.synced === 0}
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpiar Antiguos
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>• <strong>Procesar Lote:</strong> Sincroniza hasta 10 productos pendientes</p>
                <p>• <strong>Reintentar Fallidos:</strong> Vuelve a poner en cola los productos con error</p>
                <p>• <strong>Limpiar Antiguos:</strong> Elimina registros completados de más de 30 días</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resultados del Último Procesamiento</CardTitle>
              <CardDescription>
                Detalles de la última operación de sincronización
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lastResults ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{lastResults.processed}</div>
                    <div className="text-sm text-muted-foreground">Procesados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{lastResults.successful}</div>
                    <div className="text-sm text-muted-foreground">Exitosos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{lastResults.failed}</div>
                    <div className="text-sm text-muted-foreground">Fallidos</div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay resultados recientes</p>
                  <p className="text-sm">Procesa un lote para ver los resultados aquí</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
