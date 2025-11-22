'use client';

import Link from 'next/link';
import { CheckCircle2, AlertCircle, Loader2, ShoppingBag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { useMercadoLibreStatus } from '@/hooks/useMercadoLibreStatus';

export function MercadoLibreStatus() {
  const { data, isLoading, error } = useMercadoLibreStatus();

  const isConnected = Boolean(data?.connected);
  const hasError = Boolean(error);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <ShoppingBag className="mr-2 h-4 w-4" />
          Estado de MercadoLibre
        </CardTitle>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isConnected ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-yellow-500" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoading ? 'Cargando...' : isConnected ? 'Conectado' : 'Desconectado'}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {isConnected
            ? `Usuario: ${data?.userId || 'N/A'}`
            : hasError
            ? 'Error al obtener el estado de MercadoLibre'
            : 'No conectado a MercadoLibre'}
        </p>
        <div className="mt-4">
          <Link href="/admin/mercadolibre">
            <Button variant="outline" size="sm" className="w-full">
              {isConnected ? 'Administrar' : 'Conectar'}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
