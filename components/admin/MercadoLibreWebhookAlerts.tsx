'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';

import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type WebhookStatus = 'ok' | 'warning' | 'error';

interface WebhookSummaryResponse {
  total: number;
  pending: number;
  failed: number;
  deadLetter: number;
  lastEventAt: string | null;
  latestFailures: FailedWebhook[];
  alerts: Array<{
    severity: WebhookStatus;
    title: string;
    description: string;
    remediation?: string;
  }>;
}

interface FailedWebhook {
  id: number;
  platform: 'mercadolibre' | 'mercadopago';
  paymentId?: string | null;
  requestId?: string | null;
  topic?: string | null;
  resource?: string | null;
  status: string;
  retryCount: number;
  errorMessage: string | null;
  nextRetryAt: string | null;
  createdAt: string | null;
  lastRetryAt: string | null;
}

const statusBadge: Record<string, string> = {
  processed: 'bg-emerald-50 text-emerald-700',
  retrying: 'bg-amber-50 text-amber-700',
  pending: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
  dead_letter: 'bg-rose-50 text-rose-700',
};

export function MercadoLibreWebhookAlerts() {
  const [data, setData] = useState<WebhookSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/webhooks/summary');
      if (!response.ok) {
        throw new Error('No se pudo obtener el estado de webhooks');
      }
      const json = (await response.json()) as WebhookSummaryResponse;
      setData(json);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Error desconocido al obtener el estado de webhooks',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const handleRetry = async (failure: FailedWebhook) => {
    try {
      setActionId(failure.id);
      if (failure.platform === 'mercadopago') {
        const response = await fetch(
          `/api/admin/webhooks/retry/${failure.id}`,
          {
            method: 'POST',
          },
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'No se pudo reintentar el webhook');
        }
      } else {
        const response = await fetch(
          '/api/admin/mercadolibre/webhooks/reprocess',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhookId: failure.id }),
          },
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'No se pudo reprocesar el webhook');
        }
      }
      toast.success('Acción ejecutada, refrescando estado…');
      await loadSummary();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Error ejecutando la acción sobre el webhook',
      );
    } finally {
      setActionId(null);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return '—';
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  };

  const severityStyles: Record<WebhookStatus, { badge: string; dot: string }> =
    {
      ok: {
        badge: 'bg-emerald-50 text-emerald-800 border border-emerald-100',
        dot: 'bg-emerald-500',
      },
      warning: {
        badge: 'bg-amber-50 text-amber-900 border border-amber-100',
        dot: 'bg-amber-500',
      },
      error: {
        badge: 'bg-red-50 text-red-900 border border-red-100',
        dot: 'bg-red-500',
      },
    };

  const overview = useMemo(() => {
    if (!data) {
      return {
        status: 'ok' as WebhookStatus,
        message: 'Sin información disponible',
      };
    }
    if (data.deadLetter > 0 || data.failed > 0) {
      return {
        status: 'error' as WebhookStatus,
        message: 'Se detectaron fallos críticos en webhooks',
      };
    }
    if (data.pending > 0) {
      return {
        status: 'warning' as WebhookStatus,
        message: 'Hay webhooks pendientes o en reintento',
      };
    }
    return {
      status: 'ok' as WebhookStatus,
      message: 'Todos los webhooks procesados correctamente',
    };
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Alertas de Webhooks ML / MP</CardTitle>
          <CardDescription>
            Visualiza fallos recientes, reintenta manualmente y consulta guías.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSummary()}
            disabled={isLoading}
            className="inline-flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Actualizando…
              </>
            ) : (
              <>
                <Bell className="h-4 w-4" />
                Actualizar
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Alert className={severityStyles[overview.status].badge}>
          <AlertTitle className="flex items-center gap-2 text-base font-semibold">
            <span
              className={`h-2 w-2 rounded-full ${severityStyles[overview.status].dot}`}
            />
            Estado general
          </AlertTitle>
          <AlertDescription className="text-sm leading-relaxed">
            {overview.message}
            {data?.lastEventAt && (
              <span className="mt-1 block text-xs text-muted-foreground">
                Último evento recibido: {formatDate(data.lastEventAt)}
              </span>
            )}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title="Eventos Totales" value={data?.total ?? 0} />
          <MetricCard
            title="Pendientes / Retry"
            value={data?.pending ?? 0}
            accent="text-amber-600"
          />
          <MetricCard
            title="Fallidos"
            value={data?.failed ?? 0}
            accent="text-red-600"
          />
          <MetricCard
            title="Dead letter (MP)"
            value={data?.deadLetter ?? 0}
            accent="text-rose-600"
          />
        </div>

        {data?.alerts?.length ? (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Alertas detectadas</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {data.alerts.map((alert, index) => (
                <Alert
                  key={`${alert.title}-${index}`}
                  variant={
                    alert.severity === 'error' ? 'destructive' : 'default'
                  }
                  className="border border-dashed"
                >
                  <AlertTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    {alert.title}
                  </AlertTitle>
                  <AlertDescription className="space-y-2 text-sm">
                    <p>{alert.description}</p>
                    {alert.remediation && (
                      <p className="text-xs text-muted-foreground">
                        Recomendación: {alert.remediation}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              Últimos incidentes registrados
            </h4>
            <p className="text-xs text-muted-foreground">
              Incluye Mercado Libre y Mercado Pago
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Recurso / Pago</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Reintentos</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Último evento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.latestFailures?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Sin incidentes registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.latestFailures.map((failure) => (
                    <TableRow key={`${failure.platform}-${failure.id}`}>
                      <TableCell className="font-medium">
                        <span className="uppercase tracking-wide text-xs text-muted-foreground">
                          {failure.platform === 'mercadolibre' ? 'ML' : 'MP'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {failure.platform === 'mercadopago'
                          ? failure.paymentId || 'N/D'
                          : failure.resource || failure.topic || 'N/D'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${statusBadge[failure.status] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {failure.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {failure.retryCount}
                      </TableCell>
                      <TableCell className="text-xs max-w-[240px] truncate">
                        {failure.errorMessage || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(failure.lastRetryAt || failure.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="inline-flex items-center gap-1 text-xs"
                          onClick={() => handleRetry(failure)}
                          disabled={actionId === failure.id}
                        >
                          {actionId === failure.id ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              En curso
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3" />
                              Reintentar
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className={`mt-2 text-3xl font-semibold ${accent ?? 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}