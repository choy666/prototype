'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Search, Eye, Package, Truck, CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import Link from 'next/link';

interface ShipmentData {
  id: string;
  orderId: number;
  orderEmail?: string;
  status: string;
  substatus?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingMode: string;
  createdAt: string;
  updatedAt: string;
  // Historial de cambios
  history?: Array<{
    status: string;
    substatus?: string;
    dateCreated: string;
    trackingNumber?: string;
  }>;
}

const statusConfig = {
  pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
  processing: { icon: Package, color: 'bg-blue-100 text-blue-800', label: 'Procesando' },
  shipped: { icon: Truck, color: 'bg-purple-100 text-purple-800', label: 'Enviado' },
  delivered: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: 'Entregado' },
  cancelled: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Cancelado' },
  returned: { icon: XCircle, color: 'bg-orange-100 text-orange-800', label: 'Devuelto' },
  failed: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Fallido' },
};

export default function ShipmentsDashboard() {
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [shippingModeFilter, setShippingModeFilter] = useState<string>('all');
  const [importAll, setImportAll] = useState(true);
  const [importOrderId, setImportOrderId] = useState('');
  const [importStatusFilter, setImportStatusFilter] = useState<'all' | string>('all');
  const [importLimit, setImportLimit] = useState(20);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    duration: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const { toast } = useToast();

  // Cargar datos de shipments
  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/shipments');

      if (!response.ok) {
        throw new Error('Error cargando shipments');
      }

      const data = await response.json();
      setShipments(data.shipments || []);
    } catch (error) {
      console.error('Error loading shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportOrders = async () => {
    try {
      setIsImporting(true);
      setImportError(null);
      const payload: Record<string, unknown> = {
        importAll,
        limit: importLimit,
      };

      if (!importAll && importOrderId.trim()) {
        payload.orderId = importOrderId.trim();
      }

      if (importStatusFilter !== 'all') {
        payload.status = importStatusFilter;
      }

      const response = await fetch('/api/mercadolibre/orders/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (!response.ok) {
        const message = json?.error || 'No se pudo importar las órdenes.';
        toast({ title: 'Error importando órdenes', description: message, variant: 'destructive' });
        setImportError(message);
        return;
      }

      setImportSummary(json.summary);
      toast({
        title: 'Importación completada',
        description: `Órdenes: ${json.summary.successful} OK, ${json.summary.failed} errores, ${json.summary.skipped} omitidas.`,
      });
      await loadShipments();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido importando órdenes.';
      setImportError(message);
      toast({ title: 'Error importando órdenes', description: message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  // Filtrar shipments
  const filteredShipments = shipments.filter((shipment) => {
    const matchesSearch =
      shipment.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.orderId.toString().includes(searchTerm) ||
      shipment.orderEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter;
    const matchesMode =
      shippingModeFilter === 'all' || shipment.shippingMode === shippingModeFilter;

    return matchesSearch && matchesStatus && matchesMode;
  });

  const getStatusBadge = (status: string, substatus?: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <div className='flex items-center gap-2'>
        <Badge className={config.color}>
          <Icon className='w-3 h-3 mr-1' />
          {config.label}
        </Badge>
        {substatus && <span className='text-xs text-gray-500'>({substatus})</span>}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className='p-6'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-center'>
            <Package className='w-12 h-12 mx-auto mb-4 text-gray-400 animate-pulse' />
            <p className='text-gray-500'>Cargando envíos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='p-6 space-y-6'>
      {/* Header */}
      <div className='flex justify-between items-center'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900'>Panel de Envíos</h1>
          <p className='text-gray-600 mt-1'>
            Gestiona y monitorea todos los envíos de Mercado Libre
          </p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={loadShipments}>
            Actualizar
          </Button>
          <Button asChild>
            <Link href='/admin/shipments/analytics'>Ver Analytics</Link>
          </Button>
        </div>
      </div>

      {/* Panel de importación */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <Download className='h-5 w-5 text-primary' />
            Importar pedidos de Mercado Libre
          </CardTitle>
          <p className='text-sm text-gray-500'>
            Trae órdenes existentes desde Mercado Libre y sincroniza sus envíos con este panel.
          </p>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            <div className='space-y-2'>
              <Label htmlFor='import-all' className='flex items-center justify-between'>
                Importar últimas órdenes
                <Switch id='import-all' checked={importAll} onCheckedChange={setImportAll} />
              </Label>
              <p className='text-xs text-muted-foreground'>
                Si está desactivado, deberás ingresar un ID específico de orden ML.
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='import-status'>Estado en Mercado Libre</Label>
              <Select
                value={importStatusFilter}
                onValueChange={(value) => setImportStatusFilter(value as typeof importStatusFilter)}
              >
                <SelectTrigger id='import-status'>
                  <SelectValue placeholder='Estado' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos</SelectItem>
                  <SelectItem value='paid'>Pagadas</SelectItem>
                  <SelectItem value='confirmed'>Confirmadas</SelectItem>
                  <SelectItem value='shipped'>Enviadas</SelectItem>
                  <SelectItem value='delivered'>Entregadas</SelectItem>
                  <SelectItem value='cancelled'>Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='import-limit'>Cantidad máxima</Label>
              <Input
                id='import-limit'
                type='number'
                min={1}
                max={200}
                value={importLimit}
                onChange={(event) => setImportLimit(Number(event.target.value))}
                placeholder='20'
              />
              <p className='text-xs text-muted-foreground'>
                Se consultan primero las órdenes más recientes.
              </p>
            </div>
          </div>

          {!importAll && (
            <div className='space-y-2'>
              <Label htmlFor='import-order-id'>ID de orden de Mercado Libre</Label>
              <Input
                id='import-order-id'
                placeholder='Ej: 1234567890'
                value={importOrderId}
                onChange={(event) => setImportOrderId(event.target.value)}
              />
            </div>
          )}

          <div className='flex flex-wrap gap-3 items-center'>
            <Button
              onClick={handleImportOrders}
              disabled={isImporting || (!importAll && !importOrderId.trim())}
            >
              {isImporting ? 'Importando...' : 'Importar ahora'}
            </Button>
            <Button variant='outline' onClick={() => loadShipments()} disabled={loading}>
              Actualizar Grid
            </Button>
          </div>

          {importSummary && (
            <Alert>
              <AlertDescription className='text-sm space-y-1'>
                <p className='font-semibold'>Última importación:</p>
                <p>Total consultadas: {importSummary.total}</p>
                <p>Importadas: {importSummary.successful}</p>
                <p>Errores: {importSummary.failed}</p>
                <p>Omitidas: {importSummary.skipped}</p>
                <p>Duración: {importSummary.duration}</p>
              </AlertDescription>
            </Alert>
          )}

          {importError && (
            <Alert variant='destructive'>
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tarjetas de resumen */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Total Envíos</p>
                <p className='text-2xl font-bold'>{shipments.length}</p>
              </div>
              <Package className='w-8 h-8 text-gray-400' />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>En Proceso</p>
                <p className='text-2xl font-bold text-blue-600'>
                  {shipments.filter((s) => s.status === 'processing').length}
                </p>
              </div>
              <Clock className='w-8 h-8 text-blue-400' />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>En Camino</p>
                <p className='text-2xl font-bold text-purple-600'>
                  {shipments.filter((s) => s.status === 'shipped').length}
                </p>
              </div>
              <Truck className='w-8 h-8 text-purple-400' />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Entregados</p>
                <p className='text-2xl font-bold text-green-600'>
                  {shipments.filter((s) => s.status === 'delivered').length}
                </p>
              </div>
              <CheckCircle className='w-8 h-8 text-green-400' />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap gap-4'>
            <div className='flex-1 min-w-[200px]'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
                <Input
                  placeholder='Buscar por ID, orden, email o tracking...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='pl-10'
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Estado' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los estados</SelectItem>
                <SelectItem value='pending'>Pendiente</SelectItem>
                <SelectItem value='processing'>Procesando</SelectItem>
                <SelectItem value='shipped'>Enviado</SelectItem>
                <SelectItem value='delivered'>Entregado</SelectItem>
                <SelectItem value='cancelled'>Cancelado</SelectItem>
                <SelectItem value='returned'>Devuelto</SelectItem>
              </SelectContent>
            </Select>

            <Select value={shippingModeFilter} onValueChange={setShippingModeFilter}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Modo de envío' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los modos</SelectItem>
                <SelectItem value='me2'>Mercado Envíos 2</SelectItem>
                <SelectItem value='me1'>Mercado Envíos 1</SelectItem>
                <SelectItem value='custom'>Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de envíos */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>
            Envíos ({filteredShipments.length} de {shipments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredShipments.length === 0 ? (
            <div className='text-center py-8'>
              <Package className='w-12 h-12 mx-auto mb-4 text-gray-400' />
              <p className='text-gray-500'>
                No se encontraron envíos que coincidan con los filtros.
              </p>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='min-w-full divide-y divide-gray-200'>
                <thead className='bg-gray-50'>
                  <tr>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Shipment ID
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Orden
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Cliente
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Estado
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Tracking
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Modo
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Actualizado
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className='bg-white divide-y divide-gray-200'>
                  {filteredShipments.map((shipment) => (
                    <tr key={shipment.id}>
                      <td className='px-6 py-4 whitespace-nowrap text-sm font-mono'>
                        {shipment.id}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <Link
                          href={`/admin/orders/${shipment.orderId}`}
                          className='text-blue-600 hover:underline'
                        >
                          #{shipment.orderId}
                        </Link>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm'>
                        {shipment.orderEmail || 'N/A'}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        {getStatusBadge(shipment.status, shipment.substatus)}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        {shipment.trackingNumber ? (
                          <div className='space-y-1'>
                            <span className='font-mono text-xs'>{shipment.trackingNumber}</span>
                            {shipment.trackingUrl && (
                              <a
                                href={shipment.trackingUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='block text-blue-600 hover:underline text-xs'
                              >
                                Ver tracking
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className='text-gray-400 text-xs'>N/A</span>
                        )}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <Badge variant='outline'>{shipment.shippingMode.toUpperCase()}</Badge>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-600'>
                        {formatDate(shipment.updatedAt)}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <div className='flex gap-1'>
                          <Button variant='ghost' size='sm' asChild>
                            <Link href={`/admin/shipments/${shipment.id}`}>
                              <Eye className='w-4 h-4' />
                            </Link>
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() =>
                              window.open(`/api/admin/shipments/${shipment.id}/label`, '_blank')
                            }
                            title='Imprimir etiqueta'
                          >
                            <Package className='w-4 h-4' />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
