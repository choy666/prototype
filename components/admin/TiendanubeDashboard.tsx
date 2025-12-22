"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Package, 
  ShoppingCart, 
  Users, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface WebhookMetrics {
  total: number;
  pending: number;
  retrying: number;
  processed: number;
  deadLetter: number;
  last24h: number;
  lastHour: number;
}

interface SyncMetrics {
  totalProducts: number;
  synced: number;
  pending: number;
  error: number;
  lastSyncAt: string | null;
  consecutiveFailures: number;
}

interface OrderMetrics {
  totalOrders: number;
  last24h: number;
  lastWeek: number;
  pendingOrders: number;
  totalCustomers: number;
}

interface DashboardMetrics {
  store: {
    storeId: string;
    status: string;
    connectedAt: string | null;
  };
  webhooks: WebhookMetrics;
  sync: SyncMetrics;
  orders: OrderMetrics;
}

interface TiendanubeDashboardProps {
  storeId: string;
}

export default function TiendanubeDashboard({ storeId }: TiendanubeDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { toast } = useToast();

  const fetchMetrics = useCallback(async () => {
    if (!storeId) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`/api/admin/tiendanube/metrics?storeId=${storeId}`);
      
      if (!response.ok) {
        throw new Error('Error obteniendo métricas');
      }
      
      const data = await response.json();
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/admin/tiendanube/sync/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, force: true }),
      });
      
      if (!response.ok) throw new Error('Error al sincronizar');
      
      const result = await response.json();
      toast({
        title: "Sincronización iniciada",
        description: `Actualizados: ${result.result.updated}, Fallidos: ${result.result.failed}`,
      });
      
      // Refrescar métricas después de un momento
      setTimeout(fetchMetrics, 2000);
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast({
        title: "Error",
        description: "No se pudo iniciar la sincronización",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Refrescar cada 30 segundos
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [storeId, fetchMetrics]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      connected: "default",
      disconnected: "destructive",
      error: "destructive",
      pending: "secondary",
    };
    
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const formatTimeAgo = (date: string | null) => {
    if (!date) return "Nunca";
    
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} d`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-gray-500">No hay datos disponibles</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard Tiendanube</h2>
          <p className="text-gray-500">
            Tienda: {metrics.store.storeId} • Última actualización: {formatTimeAgo(lastUpdated.toISOString())}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(metrics.store.status)}
          <Button
            onClick={triggerSync}
            disabled={syncing}
            variant="outline"
            size="sm"
          >
            {syncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Forzar Sync
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Totales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.orders.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              +{metrics.orders.last24h} en las últimas 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.orders.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.orders.pendingOrders} órdenes pendientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.sync.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.sync.synced} sincronizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.webhooks.processed}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.webhooks.pending} pendientes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detalles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado de Sincronización */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Sincronización de Productos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{metrics.sync.synced}</div>
                <p className="text-sm text-gray-500">Sincronizados</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{metrics.sync.pending}</div>
                <p className="text-sm text-gray-500">Pendientes</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{metrics.sync.error}</div>
                <p className="text-sm text-gray-500">Con error</p>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Última sincronización
                </span>
                <span>{formatTimeAgo(metrics.sync.lastSyncAt)}</span>
              </div>
              {metrics.sync.consecutiveFailures > 0 && (
                <div className="flex items-center justify-between text-sm text-red-600 mt-2">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Productos con fallos
                  </span>
                  <span>{metrics.sync.consecutiveFailures}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Estado de Webhooks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Estado de Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Procesados
                </span>
                <Badge variant="outline">{metrics.webhooks.processed}</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  Pendientes
                </span>
                <Badge variant="outline">{metrics.webhooks.pending}</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                  Reintentando
                </span>
                <Badge variant="outline">{metrics.webhooks.retrying}</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Dead Letter
                </span>
                <Badge variant="destructive">{metrics.webhooks.deadLetter}</Badge>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span>Última hora</span>
                <span className="flex items-center gap-1">
                  {metrics.webhooks.lastHour > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-gray-400" />
                  )}
                  {metrics.webhooks.lastHour}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span>Últimas 24h</span>
                <span>{metrics.webhooks.last24h}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
