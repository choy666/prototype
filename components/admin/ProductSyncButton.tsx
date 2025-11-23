'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ProductSyncButtonProps {
  productId: number;
  mlItemId?: string | null;
  syncStatus?: string;
  onSyncComplete?: () => void;
}

export function ProductSyncButton({
  productId,
  mlItemId,
  syncStatus,
  onSyncComplete
}: ProductSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`/api/mercadolibre/products/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId: productId.toString() }),
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success('Producto sincronizado exitosamente');
        onSyncComplete?.();
      } else {
        toast.error(result.error || 'Error al sincronizar producto');
      }
    } catch (error) {
      console.error('Error sincronizando producto:', error);
      toast.error('Error al sincronizar producto');
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'syncing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <RefreshCw className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    const statusConfig = {
      synced: { label: 'Sincronizado', variant: 'default' as const, color: 'bg-green-100 text-green-800' },
      error: { label: 'Error', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
      syncing: { label: 'Sincronizando', variant: 'secondary' as const, color: 'bg-blue-100 text-blue-800' },
      pending: { label: 'Pendiente', variant: 'outline' as const, color: 'bg-gray-100 text-gray-800' },
    };

    const config = statusConfig[syncStatus as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge variant={config.variant} className={config.color}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {getStatusIcon()}
      {getStatusBadge()}
      
      {!mlItemId ? (
        <Button
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar
            </>
          )}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(`https://articulo.mercadolibre.com.ar/${mlItemId}`, '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Ver en ML
        </Button>
      )}
    </div>
  );
}
