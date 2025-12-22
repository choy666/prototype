'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
  Loader2,
  RefreshCw,
  Store,
  Webhook,
  ExternalLink,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingBar } from '@/components/ui/loading-bar';

type TiendanubeStoreRow = {
  storeId: string;
  scopes: string | null;
  status: string;
  installedAt: string | null;
  uninstalledAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TiendanubeRemoteWebhook = {
  created_at?: string;
  updated_at?: string;
  event: string;
  id: number;
  url: string;
};

type RequiredWebhookStatusRow = {
  event: string;
  state: 'ok' | 'missing' | 'url_mismatch' | 'unknown';
  id?: number;
  url?: string;
};

type TiendanubeAdminStatus = {
  configured: boolean;
  config: {
    appId?: string;
    apiBase?: string;
    authBase?: string;
    hasClientSecret: boolean;
    userAgent?: string;
    webhooksBaseUrl?: string;
    webhookUrl?: string;
  };
  stores: TiendanubeStoreRow[];
  selectedStoreId?: string;
  remoteWebhooks?: TiendanubeRemoteWebhook[];
  webhooksError?: string | null;
  storeInfo?: unknown;
  storeInfoError?: string | null;
  requiredWebhooks?: {
    webhookUrl?: string;
    requiredStatus: RequiredWebhookStatusRow[];
  };
};

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function requiredWebhookBadgeVariant(
  state: RequiredWebhookStatusRow['state']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (state === 'ok') return 'secondary';
  if (state === 'missing') return 'destructive';
  if (state === 'url_mismatch') return 'outline';
  return 'outline';
}

function requiredWebhookLabel(state: RequiredWebhookStatusRow['state']) {
  if (state === 'ok') return 'OK';
  if (state === 'missing') return 'FALTA';
  if (state === 'url_mismatch') return 'URL DISTINTA';
  return 'DESCONOCIDO';
}

export function TiendanubeConnection() {
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<TiendanubeAdminStatus | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchStatus = useCallback(async (options?: { storeId?: string; verify?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.storeId) params.append('storeId', options.storeId);
    if (options?.verify) params.append('verify', 'true');
    
    const url = `/api/admin/tiendanube/status?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error || 'Error obteniendo estado de Tiendanube');
    }

    return (await response.json()) as TiendanubeAdminStatus;
  }, []);

  const loadBase = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchStatus();
      setStatus(data);

      const storeFromQuery = searchParams.get('storeId');

      if (!selectedStoreId) {
        if (storeFromQuery) {
          setSelectedStoreId(storeFromQuery);
        } else if (data.stores?.length) {
          setSelectedStoreId(data.stores[0].storeId);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error obteniendo estado de Tiendanube');
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus, searchParams, selectedStoreId]);

  const loadDetail = async (storeId: string, verify = false) => {
    setIsRefreshing(true);
    try {
      const data = await fetchStatus({ storeId, verify });
      setStatus(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error obteniendo detalles de Tiendanube');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConnect = () => {
    setIsConnecting(true);
    window.location.href = '/api/auth/tiendanube/connect';
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Estás seguro de que deseas desconectar la tienda?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/tiendanube/disconnect', {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Error al desconectar');
      
      toast.success('Tienda desconectada exitosamente');
      await loadBase();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desconectar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterWebhooks = async () => {
    if (!selectedStoreId) return;
    
    setIsRegistering(true);
    try {
      const response = await fetch('/api/admin/tiendanube/webhooks/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: selectedStoreId }),
      });
      
      if (!response.ok) throw new Error('Error al registrar webhooks');
      
      const result = await response.json();
      toast.success(`${result.registered} webhooks registrados exitosamente`);
      await loadDetail(selectedStoreId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar webhooks');
    } finally {
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  const currentStore = useMemo(() => {
    if (!status?.stores || !selectedStoreId) return null;
    return status.stores.find(s => s.storeId === selectedStoreId) || null;
  }, [status, selectedStoreId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingBar isLoading={true} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

  return (
    <div className="space-y-6">
      {/* Estado de Conexión */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Estado de Conexión
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentStore ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Tienda Conectada</h3>
                  <p className="text-sm text-gray-500">ID: {currentStore.storeId}</p>
                  <p className="text-sm text-gray-500">
                    Conectada el: {formatDate(currentStore.installedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={currentStore.status === 'connected' ? 'default' : 'destructive'}>
                    {currentStore.status}
                  </Badge>
                  <Button
                    onClick={() => loadDetail(selectedStoreId, true)}
                    disabled={isRefreshing}
                    variant="outline"
                    size="sm"
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Verificar tienda
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleRegisterWebhooks}
                    disabled={!selectedStoreId || isRegistering}
                  >
                    <Webhook className="h-4 w-4" />
                    Registrar webhooks
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => window.open(`https://www.tiendanube.com/admin/${currentStore.storeId}`, '_blank')}
                  variant="outline"
                  size="sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Administrar Tienda
                </Button>
                <Button
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Desconectando...
                    </>
                  ) : (
                    "Desconectar"
                  )}
                </Button>
              </div>

              {currentStore && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border bg-card p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Estado
                    </p>
                    <p className="mt-2 text-sm">{currentStore.status}</p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Instalado
                    </p>
                    <p className="mt-2 text-sm">{formatDate(currentStore.installedAt)}</p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Scopes
                    </p>
                    <p className="mt-2 text-sm font-mono break-all">
                      {currentStore.scopes || '-'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Store className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay tienda conectada</h3>
              <p className="text-gray-500 mb-4">
                Conecta tu tienda de Tiendanube para sincronizar productos y órdenes
              </p>
              <Button onClick={handleConnect} disabled={isConnecting}>
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Store className="w-4 h-4 mr-2" />
                    Conectar Tiendanube
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStoreId && status ? (
        <Card>
          <CardHeader>
            <CardTitle>Webhooks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status.webhooksError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {status.webhooksError}
              </div>
            ) : null}

            {status.requiredWebhooks?.requiredStatus?.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Requeridos (LGPD)</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {status.requiredWebhooks.requiredStatus.map((row) => (
                    <div key={row.event} className="rounded-lg border bg-card p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {row.event}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Badge variant={requiredWebhookBadgeVariant(row.state)}>
                          {requiredWebhookLabel(row.state)}
                        </Badge>
                        {row.id ? (
                          <span className="text-xs font-mono text-muted-foreground">#{row.id}</span>
                        ) : null}
                      </div>
                      {row.url ? (
                        <p className="mt-2 text-xs font-mono break-all text-muted-foreground">
                          {row.url}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {Array.isArray(status.remoteWebhooks) && status.remoteWebhooks.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Webhooks registrados en Tiendanube</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Actualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {status.remoteWebhooks.map((hook) => (
                      <TableRow key={hook.id}>
                        <TableCell className="font-mono text-xs">{hook.id}</TableCell>
                        <TableCell className="font-mono text-xs">{hook.event}</TableCell>
                        <TableCell className="text-xs font-mono break-all max-w-[420px]">
                          {hook.url}
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(hook.updated_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                No hay webhooks listados para esta tienda.
              </div>
            )}

            {status.storeInfoError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {status.storeInfoError}
              </div>
            ) : null}

            {status.storeInfo ? (
              <div className="rounded-lg border bg-card p-3 text-xs font-mono overflow-auto max-h-64">
                {JSON.stringify(status.storeInfo, null, 2)}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
