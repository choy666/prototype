'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Truck,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface SyncValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  missingConditional: string[];
}

type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error' | 'conflict';

interface SyncItem {
  id: number;
  productId: number;
  productName: string;
  syncStatus: SyncStatus;
  mlItemId: string | null;
  lastSyncAt: string | null;
  updatedAt: string | null;
  syncError: string | null;
  syncAttempts: number;
  stock?: number | null;
  me2Compatible?: boolean | null;
  mlCategoryId?: string | null;
  validation: SyncValidation | null;
}

interface SyncSummaryResponse {
  total: number;
  synced: number;
  pending: number;
  errors: number;
  items: SyncItem[];
}

const STATUS_CONFIG: Record<SyncStatus, { label: string; className: string; dot: string }> = {
  pending: {
    label: 'Pendiente',
    className: 'bg-amber-50 text-amber-800 border border-amber-200',
    dot: 'bg-amber-500',
  },
  syncing: {
    label: 'Sincronizando',
    className: 'bg-blue-50 text-blue-800 border border-blue-200',
    dot: 'bg-blue-500',
  },
  synced: {
    label: 'Sincronizado',
    className: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    dot: 'bg-emerald-500',
  },
  error: {
    label: 'Error',
    className: 'bg-red-50 text-red-800 border border-red-200',
    dot: 'bg-red-500',
  },
  conflict: {
    label: 'Conflicto',
    className: 'bg-rose-50 text-rose-800 border border-rose-200',
    dot: 'bg-rose-500',
  },
};

type StepState = 'ok' | 'warning' | 'error';

const formatSyncErrorPayload = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') {
    return 'No se pudo sincronizar el producto';
  }

  const data = payload as {
    error?: string;
    missingAttributes?: string[];
    missingConditional?: string[];
    invalidAttributes?: string[];
    details?: {
      missingRequired?: string[];
      missingConditional?: string[];
      invalidAttributes?: string[];
    };
  };

  const baseMessage =
    typeof data.error === 'string'
      ? data.error
      : 'El producto no cumple los requisitos de Mercado Libre';

  const sections: string[] = [];
  const collectList = (label: string, values: unknown) => {
    if (Array.isArray(values) && values.length > 0) {
      sections.push(`${label}: ${values.join(', ')}`);
    }
  };

  collectList('Obligatorios faltantes', data.missingAttributes ?? data.details?.missingRequired);
  collectList(
    'Condicionales faltantes',
    data.missingConditional ?? data.details?.missingConditional
  );
  collectList('Atributos inválidos', data.invalidAttributes ?? data.details?.invalidAttributes);

  return sections.length > 0 ? `${baseMessage}\n${sections.join('\n')}` : baseMessage;
};

export function MercadoLibreSyncPanel() {
  const [data, setData] = useState<SyncSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/mercadolibre/sync/status');

      if (!response.ok) {
        throw new Error('No se pudo obtener el estado de sincronización');
      }

      const json = (await response.json()) as SyncSummaryResponse;
      setData(json);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido al obtener la sincronización';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleProcessBatch = async () => {
    try {
      setIsProcessing(true);
      const response = await fetch('/api/mercadolibre/sync/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process' }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo procesar el lote');
      }

      toast.success(
        `Lote procesado: ${payload.results?.successful ?? 0} OK, ${
          payload.results?.failed ?? 0
        } errores`
      );
      await loadStatus();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error desconocido al procesar la sincronización'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryProduct = async (productId: number) => {
    try {
      const response = await fetch('/api/mercadolibre/sync/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', productIds: [productId] }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo marcar para reintento');
      }

      toast.success('Producto marcado para reintento');
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error marcando el producto para reintento');
    }
  };

  const handleForceSync = async (productId: number) => {
    try {
      const response = await fetch('/api/mercadolibre/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(formatSyncErrorPayload(payload));
        return;
      }

      toast.success('Sincronización disparada, revisa el estado en unos segundos');
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al sincronizar el producto');
    }
  };

  const stepResults = useMemo(() => {
    return (item: SyncItem) => {
      const validation = item.validation;
      const steps: Array<{
        key: string;
        title: string;
        description: string;
        state: StepState;
      }> = [
        {
          key: 'base',
          title: 'Validación general',
          description: validation?.isValid
            ? 'Atributos básicos OK'
            : 'Revisar título, precio, stock e imágenes',
          state: validation ? (validation.isValid ? 'ok' : 'error') : 'warning',
        },
        {
          key: 'required',
          title: 'Atributos obligatorios',
          description:
            validation && validation.missingRequired.length > 0
              ? `Faltan: ${validation.missingRequired.join(', ')}`
              : 'Checklist completo',
          state: validation && validation.missingRequired.length > 0 ? 'error' : 'ok',
        },
        {
          key: 'conditional',
          title: 'Condicionales ML',
          description:
            validation && validation.missingConditional.length > 0
              ? `Revisar: ${validation.missingConditional.join(', ')}`
              : 'Sin pendientes',
          state: validation && validation.missingConditional.length > 0 ? 'warning' : 'ok',
        },
        {
          key: 'stock',
          title: 'Stock y envío',
          description:
            item.stock && item.stock > 0
              ? item.me2Compatible
                ? 'Stock listo y ME2 habilitado'
                : 'Stock OK pero ME2 deshabilitado'
              : 'Sin stock disponible',
          state: !item.stock || item.stock <= 0 ? 'error' : item.me2Compatible ? 'ok' : 'warning',
        },
      ];

      return steps;
    };
  }, []);

  const formatDate = (value: string | null) => {
    if (!value) return '—';
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  };

  return (
    <Card className='space-y-0'>
      <CardHeader className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <CardTitle>Flujo de sincronización con Mercado Libre</CardTitle>
          <CardDescription>
            Controla la cola, revisa errores y valida atributos antes de publicar.
          </CardDescription>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={() => loadStatus()} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Actualizando...
              </>
            ) : (
              <>
                <RefreshCw className='mr-2 h-4 w-4' />
                Actualizar
              </>
            )}
          </Button>
          <Button
            size='sm'
            onClick={handleProcessBatch}
            disabled={isProcessing}
            className='bg-primary text-primary-foreground hover:bg-primary/90'
          >
            {isProcessing ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Procesando...
              </>
            ) : (
              <>
                <ArrowRight className='mr-2 h-4 w-4' />
                Procesar lote
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className='space-y-6'>
        {error && (
          <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className='grid gap-4 md:grid-cols-4'>
          <SummaryCard
            title='Total en cola'
            value={data?.total ?? 0}
            accent='text-muted-foreground'
          />
          <SummaryCard
            title='Pendientes/En curso'
            value={data?.pending ?? 0}
            accent='text-amber-600'
          />
          <SummaryCard title='Sincronizados' value={data?.synced ?? 0} accent='text-emerald-600' />
          <SummaryCard title='Errores' value={data?.errors ?? 0} accent='text-red-600' />
        </div>

        <Separator />

        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-semibold'>Detalle por producto</h3>
            <p className='text-sm text-muted-foreground'>Últimos 15 intentos de sincronización</p>
          </div>

          {isLoading && !data ? (
            <div className='flex items-center justify-center py-8 text-muted-foreground'>
              <Loader2 className='mr-2 h-5 w-5 animate-spin' />
              Cargando flujo de sincronización...
            </div>
          ) : (
            <div className='space-y-4'>
              {data?.items?.length ? (
                data.items.map((item) => {
                  const steps = stepResults(item);
                  const statusConfig = STATUS_CONFIG[item.syncStatus];

                  return (
                    <Card key={item.id} className='border-border/70'>
                      <CardHeader className='space-y-2'>
                        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                          <div>
                            <h4 className='text-base font-semibold'>{item.productName}</h4>
                            <p className='text-sm text-muted-foreground'>
                              ID interno: {item.productId}
                            </p>
                          </div>
                          <Badge
                            className={`inline-flex items-center gap-2 ${statusConfig.className}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${statusConfig.dot}`} />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          <span>Última actualización: {formatDate(item.updatedAt)}</span>
                          {item.lastSyncAt && (
                            <>
                              {' · '}
                              <span>Último sync: {formatDate(item.lastSyncAt)}</span>
                            </>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className='space-y-4'>
                        {item.syncError && (
                          <Alert variant='destructive' className='text-sm'>
                            <AlertDescription>{item.syncError}</AlertDescription>
                          </Alert>
                        )}

                        <div className='grid gap-4 md:grid-cols-2'>
                          <div className='rounded-lg border bg-muted/30 p-4'>
                            <h5 className='text-sm font-semibold'>Estado actual</h5>
                            <dl className='mt-3 space-y-1 text-sm'>
                              <StatusRow
                                label='ML Item ID'
                                value={item.mlItemId ?? 'No publicado'}
                              />
                              <StatusRow
                                label='Stock disponible'
                                value={item.stock != null ? `${item.stock} u.` : 'N/D'}
                              />
                              <StatusRow
                                label='Categoría ML'
                                value={item.mlCategoryId ?? 'Sin categoría'}
                              />
                              <StatusRow label='Intentos' value={item.syncAttempts.toString()} />
                            </dl>
                          </div>

                          <div className='space-y-3'>
                            {steps.map((step) => (
                              <StepBadge
                                key={`${item.id}-${step.key}`}
                                title={step.title}
                                description={step.description}
                                state={step.state}
                              />
                            ))}
                          </div>
                        </div>

                        <div className='flex flex-wrap gap-2'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => handleRetryProduct(item.productId)}
                          >
                            <RefreshCw className='mr-2 h-4 w-4' />
                            Reintentar
                          </Button>
                          <Button size='sm' onClick={() => handleForceSync(item.productId)}>
                            <Truck className='mr-2 h-4 w-4' />
                            Sincronizar ahora
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>
                  No hay productos en la cola de sincronización.
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ title, value, accent }: { title: string; value: number; accent?: string }) {
  return (
    <Card className='border-border/70'>
      <CardHeader className='pb-2'>
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-semibold ${accent ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between border-b border-border/50 py-1 last:border-b-0'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='font-medium'>{value}</dd>
    </div>
  );
}

function StepBadge({
  title,
  description,
  state,
}: {
  title: string;
  description: string;
  state: StepState;
}) {
  const config: Record<StepState, { icon: ReactNode; className: string; text: string }> = {
    ok: {
      icon: <CheckCircle2 className='h-4 w-4 text-emerald-600' />,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      text: 'Completado',
    },
    warning: {
      icon: <TriangleAlert className='h-4 w-4 text-amber-600' />,
      className: 'border-amber-200 bg-amber-50 text-amber-900',
      text: 'Atención',
    },
    error: {
      icon: <ShieldAlert className='h-4 w-4 text-red-600' />,
      className: 'border-red-200 bg-red-50 text-red-900',
      text: 'Bloqueado',
    },
  };

  const variant = config[state];

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm shadow-sm ${variant.className}`}>
      <div className='flex items-center gap-2 font-semibold'>
        {variant.icon}
        <span>{title}</span>
        <span className='text-xs font-medium opacity-80'>· {variant.text}</span>
      </div>
      <p className='mt-1 text-xs leading-relaxed'>{description}</p>
    </div>
  );
}
