'use client';

import Link from 'next/link';
import { CheckCircle2, AlertCircle, Loader2, CreditCard, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useCallback } from 'react';

interface MercadoPagoStatus {
  connected: boolean;
  userId?: string;
  accessToken?: boolean;
  refreshToken?: boolean;
}

interface PaymentStats {
  total: number;
  paid: number;
  pending: number;
  failed: number;
  totalAmount: number;
}

export function MercadoPagoStatus() {
  const [status, setStatus] = useState<MercadoPagoStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);

  const isConnected = Boolean(status?.connected);
  const hasError = Boolean(error);

  const fetchPaymentStats = useCallback(async () => {
    try {
      const response = await fetch('/api/mercadopago/stats');
      if (response.ok) {
        const data = await response.json();
        setPaymentStats(data);
      }
    } catch (error) {
      console.error('Error obteniendo estadísticas de pagos:', error);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/mercadopago/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setError(null);
        
        // Si está conectado, obtener estadísticas de pagos
        if (data.connected) {
          fetchPaymentStats();
        }
      } else {
        setError('Error al obtener el estado de MercadoPago');
      }
    } catch (error) {
      setError('Error de conexión con MercadoPago');
      console.error('Error obteniendo estado de MercadoPago:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPaymentStats]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <CreditCard className="mr-2 h-4 w-4" />
          Estado de MercadoPago
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
            ? `Listo para recibir pagos`
            : hasError
            ? 'Error al obtener el estado de MercadoPago'
            : 'No conectado a MercadoPago'}
        </p>
        
        {/* Estadísticas de pagos */}
        {isConnected && paymentStats && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-3 w-3 text-green-500" />
              <span className="text-xs font-medium">Pagos:</span>
              <Badge variant="outline" className="text-xs">
                {paymentStats.paid}/{paymentStats.total}
              </Badge>
            </div>
            
            <div className="text-xs text-muted-foreground">
              Total recaudado: ${paymentStats.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </div>
            
            {paymentStats.pending > 0 && (
              <div className="text-xs text-yellow-600">
                {paymentStats.pending} pendientes de pago
              </div>
            )}
            
            {paymentStats.failed > 0 && (
              <div className="text-xs text-red-600">
                {paymentStats.failed} pagos fallidos
              </div>
            )}
          </div>
        )}
        
        {/* Estado de tokens */}
        {isConnected && status && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tokens:</span>
              <Badge 
                variant={status.accessToken ? "default" : "destructive"} 
                className="text-xs"
              >
                Access {status.accessToken ? 'OK' : 'Missing'}
              </Badge>
              <Badge 
                variant={status.refreshToken ? "default" : "destructive"} 
                className="text-xs"
              >
                Refresh {status.refreshToken ? 'OK' : 'Missing'}
              </Badge>
            </div>
          </div>
        )}
        
        <div className="mt-4">
          <Link href="/admin/mercadopago">
            <Button variant="outline" size="sm" className="w-full">
              {isConnected ? 'Administrar' : 'Conectar'}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
