'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertCircle, TestTube, RefreshCw, CreditCard, Webhook, BarChart3, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LoadingBar } from '@/components/ui/loading-bar';

interface MercadoPagoStatus {
  connected: boolean;
  accountId?: string;
  accountType?: string;
  environment: 'sandbox' | 'production';
  publicKey?: string;
  hasWebhookSecret: boolean;
  webhookUrl?: string;
  lastTest?: {
    success: boolean;
    responseTime: string;
    message: string;
    timestamp: string;
  };
  stats?: {
    totalPayments: number;
    approvedPayments: number;
    rejectedPayments: number;
    pendingPayments: number;
    totalAmount: number;
    period: string;
  };
  webhookEvents?: Array<{
    id: string;
    type: string;
    status: 'received' | 'processed' | 'failed';
    timestamp: string;
    paymentId?: string;
  }>;
}

export function MercadoPagoConnection() {
  const [isTesting, setIsTesting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<MercadoPagoStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  const fetchConnectionStatus = async () => {
    try {
      const response = await fetch('/api/admin/mercadopago/status');
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data);
      } else {
        toast.error('Error al obtener el estado de MercadoPago');
      }
    } catch (error) {
      console.error('Error obteniendo estado de MercadoPago:', error);
      toast.error('Error al obtener el estado de MercadoPago');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    setIsRefreshingStats(true);
    try {
      const response = await fetch('/api/admin/mercadopago/stats');
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(prev => prev ? { ...prev, stats: data } : null);
      }
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      toast.error('Error al obtener estadísticas');
    } finally {
      setIsRefreshingStats(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const response = await fetch('/api/mercadopago/test-connection', {
        method: 'GET',
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success('Conexión con MercadoPago verificada correctamente');
        await fetchConnectionStatus();
      } else {
        toast.error(data.error || 'Error al probar la conexión');
      }
    } catch (error) {
      console.error('Error testing MercadoPago connection:', error);
      toast.error('Error al probar la conexión con MercadoPago');
    } finally {
      setIsTesting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchConnectionStatus();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="ml-3 text-sm text-muted-foreground">Cargando estado de conexión con MercadoPago...</span>
      </div>
    );
  }

  const isConnected = Boolean(connectionStatus?.connected);

  return (
    <div className="space-y-6">
      <LoadingBar isLoading={isTesting || isRefreshing || isRefreshingStats} />

      {/* Encabezado de estado */}
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Configuración de MercadoPago</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona la conexión con MercadoPago, configuración de webhooks y estadísticas de pagos.
          </p>
        </div>
        <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-muted/40">
          {isConnected ? (
            <>
              <CheckCircle2 className="mr-1.5 h-4 w-4 text-green-500" />
              <span className="text-green-700">
                {connectionStatus?.environment === 'sandbox' ? 'Sandbox' : 'Producción'} - Conectado
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="mr-1.5 h-4 w-4 text-yellow-500" />
              <span className="text-yellow-700">No configurado</span>
            </>
          )}
        </div>
      </div>

      {isConnected && connectionStatus ? (
        <div className="space-y-6">
          {/* Datos de la cuenta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Información de la Cuenta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    ID de Cuenta
                  </h3>
                  <p className="mt-2 text-sm font-mono break-all">
                    {connectionStatus.accountId || 'No disponible'}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ambiente
                  </h3>
                  <div className="mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs">
                    {connectionStatus.environment === 'sandbox' ? (
                      <>
                        <div className="mr-1.5 h-2 w-2 rounded-full bg-yellow-500" />
                        <span className="text-yellow-700">Sandbox - Pruebas</span>
                      </>
                    ) : (
                      <>
                        <div className="mr-1.5 h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-green-700">Producción</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Clave Pública
                </h3>
                <p className="mt-2 text-sm font-mono break-all">
                  {connectionStatus.publicKey || 'No disponible'}
                </p>
              </div>

              {connectionStatus.lastTest && (
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Última prueba exitosa
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-green-700">
                    {connectionStatus.lastTest.message} • {connectionStatus.lastTest.responseTime} • 
                    {new Date(connectionStatus.lastTest.timestamp).toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuración de Webhooks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Configuración de Webhooks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  URL del Webhook
                </h3>
                <p className="mt-2 text-sm font-mono break-all">
                  {connectionStatus.webhookUrl || 'No configurada'}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Secreto del Webhook
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-sm font-mono">
                    {connectionStatus.hasWebhookSecret ? (
                      showSecret ? '***SECRETO_CONFIGURADO***' : '••••••••••••••••'
                    ) : (
                      'No configurado'
                    )}
                  </p>
                  {connectionStatus.hasWebhookSecret && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Últimos eventos del webhook */}
              {connectionStatus.webhookEvents && connectionStatus.webhookEvents.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Últimos Eventos Recibidos
                  </h3>
                  <div className="space-y-2">
                    {connectionStatus.webhookEvents.slice(0, 5).map((event) => (
                      <div key={event.id} className="flex items-center justify-between rounded-lg border p-2">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${
                            event.status === 'processed' ? 'bg-green-500' :
                            event.status === 'received' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <span className="text-sm">{event.type}</span>
                          {event.paymentId && (
                            <span className="text-xs text-muted-foreground">#{event.paymentId}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estadísticas de Pagos */}
          {connectionStatus.stats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Estadísticas de Pagos
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchStats}
                    disabled={isRefreshingStats}
                  >
                    {isRefreshingStats ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{connectionStatus.stats.totalPayments}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{connectionStatus.stats.approvedPayments}</div>
                    <div className="text-sm text-muted-foreground">Aprobados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{connectionStatus.stats.rejectedPayments}</div>
                    <div className="text-sm text-muted-foreground">Rechazados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{connectionStatus.stats.pendingPayments}</div>
                    <div className="text-sm text-muted-foreground">Pendientes</div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Monto total procesado ({connectionStatus.stats.period})
                    </span>
                    <span className="text-lg font-semibold">
                      ${connectionStatus.stats.totalAmount.toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                </div>

                {connectionStatus.stats.totalPayments > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Tasa de aprobación: {Math.round((connectionStatus.stats.approvedPayments / connectionStatus.stats.totalPayments) * 100)}%
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Acciones */}
          <div className="pt-2 grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="w-full inline-flex items-center justify-center"
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
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full inline-flex items-center justify-center"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualizar estado
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="pt-4 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
          <h3 className="mt-2 text-sm font-semibold text-yellow-800">
            MercadoPago no configurado
          </h3>
          <p className="mt-1 text-sm text-yellow-700">
            Debes configurar las variables de entorno de MercadoPago para activar los pagos.
          </p>
          <div className="mt-4">
            <Button variant="outline" onClick={handleTestConnection}>
              <TestTube className="mr-2 h-4 w-4" />
              Verificar configuración
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
