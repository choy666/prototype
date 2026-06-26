'use client';

import Link from 'next/link';
import { CheckCircle2, AlertCircle, Loader2, CreditCard, Activity, Clock, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';

interface WebhookEvent {
  id: string;
  type: string;
  status: 'received' | 'processed' | 'failed';
  timestamp: string;
  paymentId: string;
}

interface MercadoPagoStatus {
  connected: boolean;
  accountId?: string;
  accountType?: string;
  environment: 'sandbox' | 'production';
  publicKey?: string;
  hasWebhookSecret: boolean;
  webhookUrl?: string;
  lastTest?: {
    success: boolean;
    responseTime: string;
    message: string;
    timestamp: string;
  };
  webhookEvents?: WebhookEvent[];
  error?: string;
}

export function MercadoPagoCard() {
  const [status, setStatus] = useState<MercadoPagoStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/mercadopago/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setError(null);
      } else {
        setError('Error al obtener estado de MercadoPago');
      }
    } catch (error) {
      console.error('Error obteniendo estado de MercadoPago:', error);
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const isConnected = status?.connected;
  const isSandbox = status?.environment === 'sandbox';
  const recentEvents = status?.webhookEvents?.slice(0, 3) || [];

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'payment.created':
        return <CreditCard className="h-3 w-3" />;
      case 'payment.updated':
        return <Activity className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const getEventColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'text-green-600';
      case 'received':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

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
            ? `Cuenta: ${status?.accountId || 'N/A'}`
            : error || 'No conectado a MercadoPago'}
        </p>

        {/* Ambiente y configuración */}
        {isConnected && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={isSandbox ? 'secondary' : 'default'} className="text-xs">
                {isSandbox ? 'Sandbox' : 'Producción'}
              </Badge>
              {!status?.hasWebhookSecret && (
                <Badge variant="destructive" className="text-xs">
                  Sin webhook
                </Badge>
              )}
            </div>

            {/* Última prueba de conexión */}
            {status?.lastTest && (
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Última prueba:</span>
                  <span className={status.lastTest.success ? 'text-green-600' : 'text-red-600'}>
                    {status.lastTest.success ? '✓ ' : '✗ '}{status.lastTest.responseTime}
                  </span>
                </div>
              </div>
            )}

            {/* Eventos recientes */}
            {recentEvents.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-3 w-3 text-blue-500" />
                  <span className="text-xs font-medium">Eventos recientes:</span>
                </div>
                {recentEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      {getEventIcon(event.type)}
                      <span className="text-muted-foreground">{event.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">#{event.paymentId}</span>
                      <span className={getEventColor(event.status)}>
                        {new Date(event.timestamp).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <Link href="/admin/mercadopago">
            <Button variant="outline" size="sm" className="w-full">
              <Settings className="mr-2 h-3 w-3" />
              {isConnected ? 'Configurar' : 'Conectar'}
            </Button>
          </Link>
          
          {/* Botón de refrescar */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={fetchStatus}
            disabled={isLoading}
          >
            <Activity className="mr-2 h-3 w-3" />
            Actualizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
