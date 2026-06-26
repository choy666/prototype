'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { Loader2, CheckCircle2, AlertCircle, TestTube, RefreshCw, Clock, ShieldAlert, Info } from 'lucide-react';
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
  const [isReauthorizing, setIsReauthorizing] = useState(false);
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

  const missingCriticalScopes = connectionStatus?.missingCriticalScopes ?? [];
  const hasMissingScopes = missingCriticalScopes.length > 0;
  const reauthReason = connectionStatus?.mlReauthReason ?? (hasMissingScopes ? 'scope_missing' : null);
  const needsReauth = Boolean(connectionStatus?.mlNeedsReauth || hasMissingScopes);
  const moduleFriendlyNames: Record<string, string> = {
    auth: 'Autenticación básica',
    products: 'Productos y atributos',
    inventory: 'Inventario',
    orders: 'Órdenes',
    messages: 'Mensajes y postventa',
  };
  const moduleStatuses = connectionStatus?.modules ?? [];
  const hasModuleGaps = moduleStatuses.some((module) => !module.hasAllScopes);
  const scopeDescriptions: Record<string, string> = {
    read: 'Permite consultar recursos básicos (usuarios, items, órdenes).',
    write: 'Habilita la creación/actualización de recursos (items, stock, envíos).',
    offline_access: 'Concede refresh tokens para operar en segundo plano.',
    read_orders: 'Necesario para sincronizar pedidos y estados.',
    write_products: 'Obligatorio para publicar y actualizar listados.',
    read_products: 'Permite leer atributos, variaciones y categorías.',
    read_inventory: 'Requerido para consultar stock y depósitos.',
    write_inventory: 'Permite actualizar stock disponible y reservado.',
    read_shipping: 'Obtiene información de envíos y etiquetas.',
    write_shipping: 'Permite generar envíos, etiquetas y manejar logística.',
    read_user_email: 'Permite leer emails del comprador (según políticas).',
    read_user_profile: 'Accede a datos básicos del perfil del vendedor.',
  };

  const getScopeTooltip = (scope: string) =>
    scopeDescriptions[scope] ??
    'Permiso requerido por la API de Mercado Libre. Asegúrate de aceptarlo durante la autorización.';
  const missingScopeSet = new Set(missingCriticalScopes);

  const siteBanner =
    connectionStatus?.mlSiteId && connectionStatus.mlSiteId !== 'MLA'
      ? {
          title: `Operando en sitio ${connectionStatus.mlSiteId}`,
          description:
            'Algunos flujos (envíos, impuestos, categorías) difieren según el país. Verifica que las configuraciones locales coincidan con este sitio.',
        }
      : null;

  const riskyLevels = ['1', '2', '3', 'beginner', 'newbie', 'low'];
  const levelBanner =
    connectionStatus?.mlLevelId && riskyLevels.includes(connectionStatus.mlLevelId.toLowerCase())
      ? {
          title: `Nivel de reputación ${connectionStatus.mlLevelId}`,
          description:
            'Una reputación baja puede limitar publicaciones y tiempos de acreditación. Revisa métricas de calidad en Mercado Libre.',
        }
      : null;

  const reauthReasonCopy: Record<
    string,
    { title: string; description: string }
  > = {
    token_expired: {
      title: 'Sesión caducada',
      description:
        'Tus credenciales de Mercado Libre expiraron. Reautoriza la cuenta para seguir sincronizando productos y pedidos.',
    },
    refresh_failed: {
      title: 'No se pudo refrescar el token',
      description:
        'La API rechazó el intento de refrescar el token. Debes volver a autorizar el acceso para restablecer la conexión.',
    },
    scope_missing: {
      title: 'Faltan permisos obligatorios',
      description:
        'La cuenta no tiene todos los permisos requeridos para envíos y órdenes. Reautoriza aceptando todos los scopes sugeridos.',
    },
    manual: {
      title: 'Reautorización requerida',
      description:
        'Se solicitó una reautorización manual para revisar permisos y credenciales. Completa el proceso para continuar.',
    },
    invalid_token: {
      title: 'Token inválido',
      description:
        'Mercado Libre invalidó el token actual. Reautoriza para generar nuevas credenciales.',
    },
    auth_error: {
      title: 'Error de autenticación',
      description:
        'Detectamos un error de autenticación con Mercado Libre. Reautoriza para asegurar el acceso.',
    },
  };

  const reauthCopy =
    (reauthReason && reauthReasonCopy[reauthReason]) ||
    reauthReasonCopy.scope_missing;

  const handleReauthorize = async () => {
    try {
      setIsReauthorizing(true);
      const response = await fetch('/api/auth/mercadolibre/reauthorize', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('No se pudo iniciar la reautorización');
      }

      const { url } = (await response.json()) as { url?: string };

      if (!url) {
        throw new Error('Mercado Libre no devolvió la URL de autorización');
      }

      window.location.href = url;
    } catch (error) {
      console.error('Error iniciando reautorización de MercadoLibre:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Error al iniciar la reautorización',
      );
      setIsReauthorizing(false);
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

  const loaderIsActive = isConnecting || isTesting || isSyncing || isReauthorizing;

  if (isStatusLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="ml-3 text-sm text-muted-foreground">Cargando estado de conexión con MercadoLibre...</span>
      </div>
    );
  }

  const isConnected = Boolean(connectionStatus?.connected);

  return (
    <div className="space-y-6">
      <LoadingBar isLoading={loaderIsActive} />

      {/* Encabezado de estado */}
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Configuración de MercadoLibre</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona la conexión de tu cuenta de MercadoLibre, permisos y estado de sincronización.
          </p>
        </div>
        <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-muted/40">
          {needsReauth && (
            <Alert variant="destructive" className="border-amber-500/70 bg-amber-50 text-amber-900">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <AlertTitle className="flex items-center gap-2 text-base font-semibold">
                {reauthCopy.title}
              </AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{reauthCopy.description}</p>
                {hasMissingScopes && (
                  <div className="flex flex-wrap gap-2">
                    {missingCriticalScopes.map((scope) => (
                      <Badge key={scope} variant="secondary" className="bg-white text-amber-900">
                        Falta: {scope}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    onClick={handleReauthorize}
                    disabled={isReauthorizing}
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    {isReauthorizing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Redirigiendo a Mercado Libre...
                      </>
                    ) : (
                      'Reautorizar ahora'
                    )}
                  </Button>
                  <Button variant="ghost" onClick={refetchStatus} disabled={loaderIsActive}>
                    Volver a comprobar
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {isConnected ? (
            <>
              <CheckCircle2 className="mr-1.5 h-4 w-4 text-green-500" />
              <span className="text-green-700">Conectado a MercadoLibre</span>
            </>
          ) : (
            <>
              <AlertCircle className="mr-1.5 h-4 w-4 text-yellow-500" />
              <span className="text-yellow-700">No conectado</span>
            </>
          )}
        </div>
      </div>

      {isConnected ? (
        <>
          {(siteBanner || levelBanner) && (
            <div className="space-y-3">
              {siteBanner && (
                <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900">
                  <Info className="mt-1 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">{siteBanner.title}</p>
                    <p className="text-sm text-blue-900/80">{siteBanner.description}</p>
                  </div>
                </div>
              )}
              {levelBanner && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <ShieldAlert className="mt-1 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">{levelBanner.title}</p>
                    <p className="text-sm text-amber-900/80">{levelBanner.description}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {needsReauth && (
            <Alert variant="destructive" className="border-amber-500/70 bg-amber-50 text-amber-900">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <AlertTitle className="flex items-center gap-2 text-base font-semibold">
                {reauthCopy.title}
              </AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{reauthCopy.description}</p>
                {hasMissingScopes && (
                  <div className="flex flex-wrap gap-2">
                    {missingCriticalScopes.map((scope) => (
                      <Badge key={scope} variant="secondary" className="bg-white text-amber-900">
                        Falta: {scope}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    onClick={handleReauthorize}
                    disabled={isReauthorizing}
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    {isReauthorizing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Redirigiendo a Mercado Libre...
                      </>
                    ) : (
                      'Reautorizar ahora'
                    )}
                  </Button>
                  <Button variant="ghost" onClick={refetchStatus} disabled={loaderIsActive}>
                    Volver a comprobar
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium mb-2">Permisos otorgados</h3>
            {connectionStatus?.scopes && connectionStatus.scopes.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                {connectionStatus.scopes.map((scope) => (
                  <Tooltip key={scope} content={getScopeTooltip(scope)}>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-mono ${
                        missingScopeSet.has(scope)
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {scope}
                    </span>
                  </Tooltip>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay permisos disponibles</p>
            )}
          </div>

          {moduleStatuses.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Estado por módulo</h3>
                  {hasModuleGaps ? (
                    <p className="text-xs text-amber-600">
                      Faltan permisos en algunos módulos. Reautoriza aceptando todos los scopes.
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600">Todos los módulos tienen los permisos requeridos.</p>
                  )}
                </div>
                <Badge
                  variant={hasModuleGaps ? 'destructive' : 'secondary'}
                  className={
                    hasModuleGaps
                      ? 'bg-amber-600/10 text-amber-900 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }
                >
                  {hasModuleGaps ? 'Acción requerida' : 'En orden'}
                </Badge>
              </div>
              <div className="space-y-2">
                {moduleStatuses.map((module) => {
                  const friendlyName = moduleFriendlyNames[module.module] || module.module;
                  return (
                    <div
                      key={module.module}
                      className="rounded-lg border p-3 transition hover:bg-muted/30"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">{friendlyName}</p>
                          {module.missingScopes.length > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Faltan {module.missingScopes.length} permiso(s)
                            </p>
                          ) : (
                            <p className="text-xs text-emerald-600">Permisos completos</p>
                          )}
                        </div>
                        <Badge
                          variant={module.hasAllScopes ? 'secondary' : 'destructive'}
                          className={
                            module.hasAllScopes
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }
                        >
                          {module.hasAllScopes ? 'Listo' : 'Faltan permisos'}
                        </Badge>
                      </div>
                      {module.missingScopes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {module.missingScopes.map((scope) => (
                            <Tooltip key={scope} content={getScopeTooltip(scope)}>
                              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                                {scope}
                              </span>
                            </Tooltip>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2 grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || !isConnected}
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
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="w-full inline-flex items-center justify-center"
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
        </>
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
