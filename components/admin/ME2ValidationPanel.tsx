'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ME2Guidelines } from '@/components/admin/ME2Guidelines';

interface ProductValidation {
  productId: number;
  productName: string;
  isValid: boolean;
  missingAttributes: string[];
  warnings: string[];
  canUseME2: boolean;
}

interface ME2SummaryResponse {
  totalProducts: number;
  validProducts: number;
  invalidProducts: number;
  warnings: string[];
  products: ProductValidation[];
}

interface ApiResponse {
  success: boolean;
  summary: ME2SummaryResponse;
}

export function ME2ValidationPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<ME2SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/me2-validation');

      if (!response.ok) {
        throw new Error('No se pudo obtener el resumen ME2');
      }

      const json = (await response.json()) as ApiResponse;

      if (!json.success) {
        throw new Error('La API devolvió un error al validar ME2');
      }

      setSummary(json.summary);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error desconocido al obtener la validación ME2';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const invalidProducts = useMemo(() => {
    if (!summary) return [];
    return summary.products
      .filter((product) => !product.isValid)
      .sort((a, b) => b.missingAttributes.length - a.missingAttributes.length);
  }, [summary]);

  const validRatio = summary?.totalProducts
    ? Math.round((summary.validProducts / summary.totalProducts) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Checklist Mercado Envíos 2 (ME2)</CardTitle>
          <CardDescription>
            Valida que cada producto cumpla peso, dimensiones, modo de envío y
            atributos obligatorios antes de publicar en Mercado Libre.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadSummary()}
          disabled={isLoading}
          className="inline-flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {isLoading ? 'Actualizando…' : 'Recalcular'}
        </Button>
      </CardHeader>

      <Separator className="mx-6" />

      <CardContent className="space-y-6 pt-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error al obtener validaciones</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!error && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Productos evaluados
                </p>
                <p className="mt-2 text-3xl font-bold">
                  {summary?.totalProducts ?? '--'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total de productos activos
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Compatibles ME2
                  </p>
                </div>
                <p className="mt-2 text-3xl font-bold text-green-700">
                  {summary?.validProducts ?? '--'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {validRatio}% de cobertura
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Requieren corrección
                  </p>
                </div>
                <p className="mt-2 text-3xl font-bold text-amber-700">
                  {summary?.invalidProducts ?? '--'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Revisar atributos faltantes para ME2
                </p>
              </div>
            </div>

            {summary?.warnings?.length ? (
              <Alert variant="default" className="bg-blue-50">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="space-y-1">
                  <p className="text-sm font-medium text-blue-900">
                    Advertencias globales
                  </p>
                  <ul className="list-disc pl-5 text-sm text-blue-800">
                    {summary.warnings.slice(0, 4).map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Productos con bloqueos ME2
                </h3>
                <p className="text-sm text-muted-foreground">
                  Revisa los atributos faltantes antes de sincronizar.
                </p>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Atributos faltantes
                      </TableHead>
                      <TableHead>Warnings</TableHead>
                      <TableHead className="text-right">
                        Estado ME2
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invalidProducts.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-sm text-muted-foreground py-10"
                        >
                          Todos los productos cumplen los requisitos de ME2 🎉
                        </TableCell>
                      </TableRow>
                    )}
                    {invalidProducts.slice(0, 10).map((product) => (
                      <TableRow key={product.productId}>
                        <TableCell className="font-medium">
                          {product.productName}
                          <span className="block text-xs text-muted-foreground">
                            ID interno: {product.productId}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {product.missingAttributes.map((attribute) => (
                              <Badge
                                key={attribute}
                                variant="secondary"
                                className="bg-red-50 text-red-700"
                              >
                                {attribute}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                            {product.warnings.slice(0, 3).map((warning, idx) => (
                              <span key={idx}>• {warning}</span>
                            ))}
                            {product.warnings.length > 3 && (
                              <span>
                                + {product.warnings.length - 3} advertencias
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="destructive"
                            className="bg-amber-100 text-amber-800"
                          >
                            Requiere ajustes
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-4">
              <ME2Guidelines showWarnings={false} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
