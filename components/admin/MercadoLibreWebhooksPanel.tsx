'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type MLWebhookRow = {
  id: number;
  webhookId: string | null;
  topic: string;
  resource: string | null;
  resourceId: string | null;
  processed: boolean;
  processedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  user?: {
    id: number;
    name: string | null;
    email: string;
  } | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function topicBadgeVariant(topic: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (topic === 'orders') return 'default';
  if (topic === 'items') return 'secondary';
  if (topic === 'payments') return 'outline';
  if (topic === 'questions') return 'outline';
  return 'outline';
}

export function MercadoLibreWebhooksPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [topic, setTopic] = useState('');
  const [resource, setResource] = useState('');
  const [processed, setProcessed] = useState<'all' | 'true' | 'false'>('all');
  const [data, setData] = useState<MLWebhookRow[]>([]);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (resource.trim()) {
        const r = resource.trim().toLowerCase();
        const combined = `${row.resource ?? ''} ${row.resourceId ?? ''}`.toLowerCase();
        if (!combined.includes(r)) return false;
      }
      return true;
    });
  }, [data, resource]);

  const fetchWebhooks = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (topic.trim()) params.set('topic', topic.trim());
      if (processed !== 'all') params.set('processed', processed);
      params.set('limit', '100');
      params.set('offset', '0');

      const response = await fetch(`/api/mercadolibre/webhooks?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        toast.error(result?.error || 'Error obteniendo webhooks');
        return;
      }

      setData(result.webhooks || []);
    } catch {
      toast.error('Error obteniendo webhooks');
    } finally {
      setIsLoading(false);
    }
  };

  const reprocessWebhook = async (webhookId: number) => {
    try {
      const response = await fetch('/api/admin/mercadolibre/webhooks/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        toast.error(result?.error || 'Error reprocesando webhook');
        await fetchWebhooks();
        return;
      }

      toast.success('Webhook reprocesado');
      await fetchWebhooks();
    } catch {
      toast.error('Error reprocesando webhook');
    }
  };

  useEffect(() => {
    fetchWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks de Mercado Libre</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Topic
            </label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="orders / items / questions"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Procesado
            </label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              value={processed}
              onChange={(e) => setProcessed(e.target.value as 'all' | 'true' | 'false')}
            >
              <option value="all">Todos</option>
              <option value="true">Procesados</option>
              <option value="false">No procesados</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resource / ResourceId
            </label>
            <Input
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              placeholder="Ej: /orders/123 o 123"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={fetchWebhooks} disabled={isLoading}>
            {isLoading ? 'Cargando...' : 'Actualizar'}
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Procesado</TableHead>
              <TableHead>Retry</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead>Procesado At</TableHead>
              <TableHead>Error</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  No hay webhooks para mostrar.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell>
                    <Badge variant={topicBadgeVariant(row.topic)}>{row.topic}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[420px] truncate">
                    {row.resource || '-'}
                  </TableCell>
                  <TableCell>
                    {row.processed ? (
                      <Badge variant="secondary">OK</Badge>
                    ) : (
                      <Badge variant="destructive">PENDIENTE</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.retryCount}</TableCell>
                  <TableCell className="text-xs">{formatDate(row.createdAt)}</TableCell>
                  <TableCell className="text-xs">{formatDate(row.processedAt)}</TableCell>
                  <TableCell className="text-xs max-w-[320px] truncate">
                    {row.errorMessage || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reprocessWebhook(row.id)}
                      disabled={isLoading}
                    >
                      Reprocesar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
