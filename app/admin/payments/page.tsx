'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, AlertCircle, CheckCircle, XCircle, Clock, Search, Filter, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface PaymentData {
  id: number;
  paymentId: string;
  status: string;
  amount: string;
  currencyId: string;
  externalReference: string;
  paymentMethodId: string;
  dateCreated: string;
  dateApproved: string | null;
  requiresManualVerification: boolean;
  hmacValidationResult: string | null;
  hmacFailureReason: string | null;
  hmacFallbackUsed: boolean;
  verificationTimestamp: string | null;
  webhookRequestId: string | null;
  orderId: number | null;
}

interface PaymentsResponse {
  payments: PaymentData[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export default function PaymentsAuditPage() {
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(filter !== 'all' && { filter }),
      });

      const response = await fetch(`/api/admin/payments?${params}`);
      if (!response.ok) {
        throw new Error('Error cargando pagos');
      }

      const data: PaymentsResponse = await response.json();
      setPayments(data.payments);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const getStatusBadge = (payment: PaymentData) => {
    if (payment.requiresManualVerification) {
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Requiere Verificación
        </Badge>
      );
    }

    switch (payment.status) {
      case 'approved':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Aprobado
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pendiente
          </Badge>
        );
      case 'rejected':
      case 'cancelled':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            {payment.status === 'rejected' ? 'Rechazado' : 'Cancelado'}
          </Badge>
        );
      default:
        return <Badge variant="outline">{payment.status}</Badge>;
    }
  };

  const getHmacBadge = (payment: PaymentData) => {
    if (!payment.hmacValidationResult) {
      return <Badge variant="outline">Sin datos</Badge>;
    }

    switch (payment.hmacValidationResult) {
      case 'valid':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Válido
          </Badge>
        );
      case 'fallback_used':
        return (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Fallback API
          </Badge>
        );
      case 'invalid':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Inválido
          </Badge>
        );
      default:
        return <Badge variant="outline">{payment.hmacValidationResult}</Badge>;
    }
  };

  const handleVerifyPayment = async (paymentId: string) => {
    try {
      const response = await fetch('/api/admin/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });

      if (!response.ok) {
        throw new Error('Error verificando pago');
      }

      // Recargar la lista
      await fetchPayments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error verificando pago');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auditoría de Pagos</h1>
          <p className="text-muted-foreground">
            Revisa y verifica los pagos que requieren atención manual debido a fallos en la validación HMAC.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros y Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar por ID de pago o referencia</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="ID de pago, referencia externa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter">Filtrar por estado</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar filtro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los pagos</SelectItem>
                  <SelectItem value="requires_manual_verification">Requieren verificación manual</SelectItem>
                  <SelectItem value="hmac_valid">HMAC válido</SelectItem>
                  <SelectItem value="hmac_fallback">Usaron fallback API</SelectItem>
                  <SelectItem value="approved">Aprobados</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="rejected">Rechazados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchPayments} disabled={loading}>
                {loading ? 'Buscando...' : 'Aplicar filtros'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de pagos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Pagos ({totalCount} encontrados)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Cargando pagos...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No se encontraron pagos con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">ID de Pago</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Estado</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Monto</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Validación HMAC</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Fecha</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Orden</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {payment.paymentId}
                            {payment.hmacFallbackUsed && (
                              <Badge variant="outline" className="text-xs">
                                Fallback
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4 align-middle">{getStatusBadge(payment)}</td>
                        <td className="p-4 align-middle">
                          ${parseFloat(payment.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                          <br />
                          <span className="text-xs text-muted-foreground">{payment.currencyId}</span>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="space-y-1">
                            {getHmacBadge(payment)}
                            {payment.hmacFailureReason && (
                              <p className="text-xs text-red-600 dark:text-red-400 max-w-xs truncate" title={payment.hmacFailureReason}>
                                {payment.hmacFailureReason}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="text-sm">
                            {new Date(payment.dateCreated).toLocaleDateString('es-ES')}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {new Date(payment.dateCreated).toLocaleTimeString('es-ES')}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          {payment.orderId ? (
                            <Link
                              href={`/admin/orders/${payment.orderId}`}
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              #{payment.orderId}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Sin orden</span>
                          )}
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex gap-2">
                            {payment.requiresManualVerification && payment.status === 'approved' && (
                              <Button
                                size="sm"
                                onClick={() => handleVerifyPayment(payment.paymentId)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verificar
                              </Button>
                            )}
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/admin/payments/${payment.paymentId}`}>
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                Detalles
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Paginación */}
          {totalCount > 20 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {((page - 1) * 20) + 1} a {Math.min(page * 20, totalCount)} de {totalCount} pagos
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page * 20 >= totalCount}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
