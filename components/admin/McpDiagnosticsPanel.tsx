'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeInfo,
  Braces,
  History,
  Loader2,
  PlugZap,
  ServerCog,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useMercadoLibreStatus } from '@/hooks/useMercadoLibreStatus';

type McpServer = 'mercadolibre' | 'mercadopago';

interface McpDiagnosticsContext {
  mlUserId?: number;
  mlConnected: boolean;
}

type FieldType = 'text' | 'number' | 'textarea' | 'select';

interface McpActionField {
  name: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  description?: string;
  options?: { label: string; value: string }[];
  defaultValue?: string;
  getDefaultValue?: (context: McpDiagnosticsContext) => string | undefined;
  syncWithContext?: boolean;
}

interface McpAction {
  id: string;
  title: string;
  description: string;
  server: McpServer;
  tool: string;
  fields?: McpActionField[];
  timeoutMs?: number;
  disabledReason?: (context: McpDiagnosticsContext) => string | undefined;
  buildArgs?: (params: {
    parsedFields: Record<string, unknown>;
    rawFields: Record<string, string>;
    context: McpDiagnosticsContext;
  }) => Record<string, unknown>;
}

interface HistoryEntry {
  id: string;
  server: McpServer;
  tool: string;
  status: 'success' | 'error';
  timestamp: string;
  durationMs?: number;
  truncated?: boolean;
  message: string;
  rawContent?: string;
}

const HISTORY_KEY = 'prototype-admin-mcp-history';
const MAX_HISTORY = 12;

const createEntryId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `mcp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function McpDiagnosticsPanel() {
  const { toast } = useToast();
  const { data: mlStatus } = useMercadoLibreStatus();
  const mlUserId = mlStatus?.userId ? Number(mlStatus.userId) : undefined;
  const context = useMemo<McpDiagnosticsContext>(
    () => ({
      mlUserId: Number.isFinite(mlUserId) ? mlUserId : undefined,
      mlConnected: Boolean(mlStatus?.connected),
    }),
    [mlUserId, mlStatus?.connected]
  );

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const stored = window.localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as HistoryEntry[];
        setHistory(parsed);
      }
    } catch {
      // Ignorar errores de parseo
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
    } catch {
      // Ignorar errores de almacenamiento
    }
  }, [history]);

  const actions: McpAction[] = useMemo(() => {
    return [
      {
        id: 'ml-user-info',
        title: 'Perfil del vendedor',
        description: 'Consulta /users/me para validar el token y los datos básicos.',
        server: 'mercadolibre',
        tool: 'get_user_info',
        disabledReason: (ctx) =>
          !ctx.mlConnected ? 'Necesita una sesión Mercado Libre activa.' : undefined,
        buildArgs: ({ context: ctx }) => ({
          userId: ctx.mlUserId,
        }),
      },
      {
        id: 'ml-check-permissions',
        title: 'Scopes y permisos',
        description: 'Verifica scopes críticos y módulos habilitados.',
        server: 'mercadolibre',
        tool: 'check_permissions',
        disabledReason: (ctx) =>
          !ctx.mlConnected ? 'Necesita una sesión Mercado Libre activa.' : undefined,
        buildArgs: ({ context: ctx }) => ({
          userId: ctx.mlUserId,
        }),
      },
      {
        id: 'ml-list-products',
        title: 'Listado de publicaciones',
        description: 'Muestra las últimas publicaciones con paginado.',
        server: 'mercadolibre',
        tool: 'list_products',
        fields: [
          {
            name: 'limit',
            label: 'Límite',
            type: 'number',
            defaultValue: '20',
            description: 'Cantidad máxima de ítems a recuperar.',
          },
          {
            name: 'offset',
            label: 'Offset',
            type: 'number',
            defaultValue: '0',
            description: 'Desplazamiento para paginar resultados.',
          },
        ],
        disabledReason: (ctx) =>
          !ctx.mlConnected ? 'Necesita una sesión Mercado Libre activa.' : undefined,
        buildArgs: ({ parsedFields, context: ctx }) => ({
          userId: ctx.mlUserId,
          ...parsedFields,
        }),
      },
      {
        id: 'ml-list-orders',
        title: 'Órdenes recientes',
        description: 'Obtiene las órdenes del vendedor para revisar integraciones.',
        server: 'mercadolibre',
        tool: 'list_orders',
        fields: [
          {
            name: 'limit',
            label: 'Límite',
            type: 'number',
            defaultValue: '20',
          },
        ],
        disabledReason: (ctx) =>
          !ctx.mlConnected ? 'Necesita una sesión Mercado Libre activa.' : undefined,
        buildArgs: ({ parsedFields, context: ctx }) => ({
          userId: ctx.mlUserId,
          ...parsedFields,
        }),
      },
      {
        id: 'mp-payment-methods',
        title: 'Métodos de pago disponibles',
        description: 'Lista los medios de pago activos para la cuenta.',
        server: 'mercadopago',
        tool: 'get_payment_methods',
      },
      {
        id: 'mp-search-payments',
        title: 'Buscar pagos',
        description: 'Permite filtrar pagos recientes por estado o referencia.',
        server: 'mercadopago',
        tool: 'search_payments',
        fields: [
          {
            name: 'criteria',
            label: 'Criterio',
            placeholder: 'external_reference:ORDER-123',
            description: 'Ej: external_reference:ORDER-123 o id:123456789',
          },
          {
            name: 'status',
            label: 'Estado',
            placeholder: 'approved / pending / rejected',
          },
          {
            name: 'limit',
            label: 'Límite',
            type: 'number',
            defaultValue: '30',
          },
        ],
      },
      {
        id: 'mp-payment-details',
        title: 'Detalle de pago',
        description: 'Inspecciona un pago puntual por ID.',
        server: 'mercadopago',
        tool: 'get_payment_details',
        fields: [
          {
            name: 'paymentId',
            label: 'Payment ID',
            placeholder: '1234567890',
            description: 'ID numérico de Mercado Pago.',
          },
        ],
      },
    ];
  }, []);

  useEffect(() => {
    setFormState((prev) => {
      const next = { ...prev };
      actions.forEach((action) => {
        if (!next[action.id]) {
          next[action.id] = {};
        }
        action.fields?.forEach((field) => {
          const calculatedDefault = field.getDefaultValue?.(context) ?? field.defaultValue ?? '';
          const shouldSync = field.syncWithContext ?? false;
          if (next[action.id][field.name] === undefined || shouldSync) {
            next[action.id][field.name] = calculatedDefault;
          }
        });
      });
      return next;
    });
  }, [actions, context]);

  const parseFieldValues = (
    action: McpAction,
    values: Record<string, string> | undefined
  ): Record<string, unknown> => {
    if (!action.fields || !values) {
      return {};
    }
    return action.fields.reduce<Record<string, unknown>>((acc, field) => {
      const rawValue = values[field.name];
      if (rawValue === undefined || rawValue === '') {
        return acc;
      }
      if (field.type === 'number') {
        const parsed = Number(rawValue);
        if (!Number.isNaN(parsed)) {
          acc[field.name] = parsed;
        }
        return acc;
      }
      acc[field.name] = rawValue;
      return acc;
    }, {});
  };

  const upsertHistory = (entry: HistoryEntry) => {
    setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
  };

  const executeAction = useCallback(
    async (action: McpAction) => {
      const disabledReason = action.disabledReason?.(context);
      if (disabledReason) {
        toast({
          title: 'Acción no disponible',
          description: disabledReason,
          variant: 'destructive',
        });
        return;
      }

      const rawFields = formState[action.id] ?? {};
      const parsedFields = parseFieldValues(action, rawFields);
      const args = action.buildArgs?.({ parsedFields, rawFields, context }) ?? parsedFields;

      setActiveActionId(action.id);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), action.timeoutMs ?? 25000);

      try {
        const response = await fetch('/api/admin/mcp/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            server: action.server,
            tool: action.tool,
            args,
            timeoutMs: action.timeoutMs ?? 25000,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null);
          throw new Error(errorPayload?.details || errorPayload?.error || 'Error desconocido');
        }

        const payload = (await response.json()) as {
          rawContent: string;
          truncated?: boolean;
          durationMs?: number;
          timestamp?: string;
          tool: string;
          server: McpServer;
        };

        const entry: HistoryEntry = {
          id: createEntryId(),
          server: payload.server,
          tool: payload.tool,
          status: 'success',
          timestamp: payload.timestamp ?? new Date().toISOString(),
          durationMs: payload.durationMs,
          truncated: payload.truncated,
          message:
            payload.rawContent.slice(0, 280) || 'La herramienta no devolvió contenido legible.',
          rawContent: payload.rawContent,
        };

        upsertHistory(entry);

        toast({
          title: 'Diagnóstico completado',
          description: `${action.title} respondió en ${payload.durationMs ?? '?'} ms`,
        });
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === 'AbortError';
        const message = isAbort
          ? 'La solicitud fue cancelada por timeout.'
          : error instanceof Error
            ? error.message
            : 'Error desconocido al invocar la herramienta.';

        upsertHistory({
          id: createEntryId(),
          server: action.server,
          tool: action.tool,
          status: 'error',
          timestamp: new Date().toISOString(),
          message,
        });

        toast({
          title: 'Diagnóstico falló',
          description: message,
          variant: 'destructive',
        });
      } finally {
        clearTimeout(timeout);
        setActiveActionId(null);
      }
    },
    [context, formState, toast]
  );

  const updateFieldValue = (actionId: string, fieldName: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [actionId]: {
        ...(prev[actionId] ?? {}),
        [fieldName]: value,
      },
    }));
  };

  return (
    <Card className='border-dashed'>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <ServerCog className='h-5 w-5' />
          <CardTitle>Diagnósticos MCP</CardTitle>
        </div>
        <p className='text-sm text-muted-foreground mt-2'>
          Ejecuta herramientas expuestas por los servidores MCP locales para obtener datos en tiempo
          real de Mercado Libre y Mercado Pago.
        </p>
        <p className='text-xs text-muted-foreground flex items-center gap-1'>
          <BadgeInfo className='h-4 w-4' />
          Los resultados se guardan en tu navegador (historial local) para que soporte pueda
          revisarlos rápidamente.
        </p>
      </CardHeader>
      <CardContent>
        <div className='grid gap-4'>
          {actions.map((action) => {
            const disabledReason = action.disabledReason?.(context);
            const isRunning = activeActionId === action.id;
            return (
              <div key={action.id} className='rounded-lg border p-4'>
                <div className='flex flex-wrap items-start justify-between gap-2'>
                  <div>
                    <div className='flex items-center gap-2'>
                      <h4 className='text-sm font-semibold'>{action.title}</h4>
                      <Badge variant={action.server === 'mercadolibre' ? 'default' : 'secondary'}>
                        {action.server === 'mercadolibre' ? 'Mercado Libre' : 'Mercado Pago'}
                      </Badge>
                    </div>
                    <p className='text-xs text-muted-foreground mt-1 max-w-2xl'>
                      {action.description}
                    </p>
                  </div>
                  <Button
                    size='sm'
                    variant='default'
                    disabled={Boolean(disabledReason) || isRunning}
                    onClick={() => void executeAction(action)}
                    className='flex items-center gap-1'
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        Ejecutando…
                      </>
                    ) : (
                      <>
                        <PlugZap className='h-4 w-4' />
                        Ejecutar
                      </>
                    )}
                  </Button>
                </div>
                {disabledReason && (
                  <p className='mt-3 text-xs text-amber-600 flex items-center gap-1'>
                    <AlertTriangle className='h-4 w-4' />
                    {disabledReason}
                  </p>
                )}

                {action.fields && action.fields.length > 0 && (
                  <div className='mt-3 grid gap-3 md:grid-cols-2'>
                    {action.fields.map((field) => {
                      const value = formState[action.id]?.[field.name] ?? '';
                      if (field.type === 'textarea') {
                        return (
                          <label key={field.name} className='text-xs font-medium'>
                            {field.label}
                            <Textarea
                              value={value}
                              placeholder={field.placeholder}
                              className='mt-1 text-sm'
                              onChange={(event) =>
                                updateFieldValue(action.id, field.name, event.target.value)
                              }
                            />
                            {field.description && (
                              <span className='text-[11px] text-muted-foreground block mt-1'>
                                {field.description}
                              </span>
                            )}
                          </label>
                        );
                      }

                      if (field.type === 'select' && field.options) {
                        return (
                          <label key={field.name} className='text-xs font-medium'>
                            {field.label}
                            <select
                              className='mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
                              value={value}
                              onChange={(event) =>
                                updateFieldValue(action.id, field.name, event.target.value)
                              }
                            >
                              <option value=''>Seleccionar…</option>
                              {field.options.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {field.description && (
                              <span className='text-[11px] text-muted-foreground block mt-1'>
                                {field.description}
                              </span>
                            )}
                          </label>
                        );
                      }

                      return (
                        <label key={field.name} className='text-xs font-medium'>
                          {field.label}
                          <Input
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={value}
                            placeholder={field.placeholder}
                            className='mt-1 h-9 text-sm'
                            onChange={(event) =>
                              updateFieldValue(action.id, field.name, event.target.value)
                            }
                          />
                          {field.description && (
                            <span className='text-[11px] text-muted-foreground block mt-1'>
                              {field.description}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Separator className='my-6' />

        <div className='flex items-center gap-2 mb-3'>
          <History className='h-5 w-5' />
          <h4 className='text-sm font-semibold'>Historial reciente</h4>
        </div>
        {history.length === 0 ? (
          <p className='text-xs text-muted-foreground'>
            Todavía no hay ejecuciones registradas. Los resultados aparecerán aquí y se guardarán
            localmente por navegador.
          </p>
        ) : (
          <div className='space-y-3'>
            {history.map((entry) => (
              <div key={entry.id} className='rounded-lg border bg-muted/30 p-3 text-xs'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant={entry.server === 'mercadolibre' ? 'default' : 'secondary'}>
                      {entry.server === 'mercadolibre' ? 'Mercado Libre' : 'Mercado Pago'}
                    </Badge>
                    <span className='font-semibold'>{entry.tool}</span>
                    <span
                      className={`text-[11px] ${
                        entry.status === 'success' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {entry.status === 'success' ? 'Éxito' : 'Error'}
                    </span>
                  </div>
                  <span className='text-[11px] text-muted-foreground'>
                    {new Date(entry.timestamp).toLocaleString('es-AR')}
                  </span>
                </div>
                <div className='mt-2 space-y-2'>
                  <p className='font-mono text-[11px] leading-relaxed bg-background/60 rounded p-2'>
                    {entry.message}
                    {entry.truncated && ' (contenido truncado)'}
                  </p>
                  {entry.rawContent && (
                    <details className='group'>
                      <summary className='flex cursor-pointer items-center gap-1 text-[11px] text-blue-600'>
                        <Braces className='h-3 w-3' />
                        Ver respuesta completa
                      </summary>
                      <pre className='mt-2 max-h-64 overflow-auto rounded bg-background p-2 text-[11px] leading-tight'>
                        {entry.rawContent}
                      </pre>
                    </details>
                  )}
                  {entry.durationMs !== undefined && (
                    <p className='text-[11px] text-muted-foreground'>
                      Latencia: {entry.durationMs} ms
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
