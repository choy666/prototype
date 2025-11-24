'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle, 
  Clock,
  Eye,
  RefreshCw,
  Download
} from 'lucide-react';
import Link from 'next/link';

interface ShippingAddress {
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  telefono: string;
}

interface ShipmentDetail {
  id: string;
  orderId: number;
  orderEmail: string;
  status: string;
  substatus?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingMode: string;
  mercadoLibreShipmentStatus: string;
  createdAt: string;
  updatedAt: string;
  total: string;
  // Información de la orden
  orderData?: {
    shippingAddress: ShippingAddress;
    items: Array<{
      name: string;
      quantity: number;
      price: string;
      dimensions?: string;
    }>;
  };
  // Historial completo
  history: Array<{
    status: string;
    substatus?: string;
    dateCreated: string;
    trackingNumber?: string;
    comment?: string;
    source: string;
  }>;
}

const statusConfig = {
  pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
  processing: { icon: Package, color: 'bg-blue-100 text-blue-800', label: 'Procesando' },
  shipped: { icon: Truck, color: 'bg-purple-100 text-purple-800', label: 'Enviado' },
  delivered: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: 'Entregado' },
  cancelled: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Cancelado' },
  returned: { icon: XCircle, color: 'bg-orange-100 text-orange-800', label: 'Devuelto' },
  failed: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Fallido' }
};

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.id as string;

  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShipmentDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/shipments/${shipmentId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Shipment no encontrado');
        } else {
          throw new Error('Error cargando detalles del shipment');
        }
        return;
      }
      
      const data = await response.json();
      setShipment(data.shipment);
    } catch (error) {
      console.error('Error loading shipment detail:', error);
      setError('Error al cargar los detalles del shipment');
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    if (shipmentId) {
      loadShipmentDetail();
    }
  }, [shipmentId, loadShipmentDetail]);

  const getStatusBadge = (status: string, substatus?: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <div className="flex items-center gap-2">
        <Badge className={config.color}>
          <Icon className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>
        {substatus && (
          <span className="text-xs text-gray-500">({substatus})</span>
        )}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRefresh = () => {
    loadShipmentDetail();
  };

  const handlePrintLabel = () => {
    if (shipment?.trackingNumber) {
      window.open(`/api/admin/shipments/${shipmentId}/label`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-pulse" />
            <p className="text-gray-500">Cargando detalles del shipment...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-red-500 mb-4">{error || 'Shipment no encontrado'}</p>
            <Button variant="outline" onClick={() => router.back()}>
              Volver
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Shipment {shipment.id}
            </h1>
            <p className="text-gray-600 mt-1">
              Orden #{shipment.orderId} • {shipment.orderEmail}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          {shipment.trackingNumber && (
            <Button variant="outline" onClick={handlePrintLabel}>
              <Download className="w-4 h-4 mr-2" />
              Imprimir Etiqueta
            </Button>
          )}
          <Button asChild>
            <Link href={`/admin/orders/${shipment.orderId}`}>
              <Eye className="w-4 h-4 mr-2" />
              Ver Orden
            </Link>
          </Button>
        </div>
      </div>

      {/* Estado actual */}
      <Card>
        <CardHeader>
          <CardTitle>Estado Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Estado</p>
              <div className="mt-1">
                {getStatusBadge(shipment.status, shipment.substatus)}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Estado ML</p>
              <Badge variant="outline" className="mt-1">
                {shipment.mercadoLibreShipmentStatus}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Modo de Envío</p>
              <Badge variant="outline" className="mt-1">
                {shipment.shippingMode.toUpperCase()}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-lg font-bold mt-1">
                ${parseFloat(shipment.total).toFixed(2)}
              </p>
            </div>
          </div>
          
          {shipment.trackingNumber && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-gray-600 mb-2">Información de Tracking</p>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded">
                  {shipment.trackingNumber}
                </span>
                {shipment.trackingUrl && (
                  <a
                    href={shipment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Ver tracking en Mercado Libre →
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fechas */}
      <Card>
        <CardHeader>
          <CardTitle>Información Temporal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Fecha de Creación</p>
              <p className="text-sm mt-1">{formatDate(shipment.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Última Actualización</p>
              <p className="text-sm mt-1">{formatDate(shipment.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dirección de envío */}
      {shipment.orderData?.shippingAddress && (
        <Card>
          <CardHeader>
            <CardTitle>Dirección de Envío</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="font-medium">{shipment.orderData.shippingAddress.nombre}</p>
              <p className="text-sm text-gray-600">{shipment.orderData.shippingAddress.direccion}</p>
              <p className="text-sm text-gray-600">
                {shipment.orderData.shippingAddress.ciudad}, {shipment.orderData.shippingAddress.provincia}
              </p>
              <p className="text-sm text-gray-600">CP: {shipment.orderData.shippingAddress.codigoPostal}</p>
              <p className="text-sm text-gray-600">Tel: {shipment.orderData.shippingAddress.telefono}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items de la orden */}
      {shipment.orderData?.items && (
        <Card>
          <CardHeader>
            <CardTitle>Items de la Orden</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {shipment.orderData.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-600">
                      Cantidad: {item.quantity} • Precio: ${parseFloat(item.price).toFixed(2)}
                    </p>
                    {item.dimensions && (
                      <p className="text-xs text-gray-500">Dimensiones: {item.dimensions}</p>
                    )}
                  </div>
                  <p className="font-bold">
                    ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial de cambios */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Cambios</CardTitle>
        </CardHeader>
        <CardContent>
          {shipment.history.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No hay historial de cambios registrado
            </p>
          ) : (
            <div className="space-y-4">
              {shipment.history.map((event, index) => (
                <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded">
                  <div className="flex-shrink-0 mt-1">
                    {getStatusBadge(event.status, event.substatus)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">
                          {statusConfig[event.status as keyof typeof statusConfig]?.label || event.status}
                        </p>
                        {event.comment && (
                          <p className="text-sm text-gray-600 mt-1">{event.comment}</p>
                        )}
                        {event.trackingNumber && (
                          <p className="text-xs text-gray-500 mt-1">
                            Tracking: {event.trackingNumber}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {formatDate(event.dateCreated)}
                        </p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {event.source}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
