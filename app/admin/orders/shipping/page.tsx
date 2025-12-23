// app/admin/orders/shipping/page.tsx
// Dashboard de despacho para administradores

'use client';

import { useState, useEffect, useCallback } from 'react';

interface OrderWithShipping {
  id: number;
  customerName: string;
  customerEmail: string;
  shippingMethodId: number | null;
  shippingCost: number;
  shippingStatus: string;
  trackingNumber: string | null;
  shippingMode: string | null;
  shippingAddress: Record<string, unknown> | null;
  createdAt: Date;
  total: number;
}

export default function ShippingDashboard() {
  const [orders, setOrders] = useState<OrderWithShipping[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'shipped'>('pending');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithShipping | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/orders/shipping?status=${filter}`);
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [filter, fetchOrders]);

  const updateShippingStatus = async (orderId: number, status: string) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/shipping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status,
          trackingCode: trackingCode || null 
        })
      });

      if (response.ok) {
        await fetchOrders();
        setSelectedOrder(null);
        setTrackingCode('');
      }
    } catch (error) {
      console.error('Error updating shipping:', error);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'processing': return 'Procesando';
      case 'shipped': return 'Enviado';
      case 'delivered': return 'Entregado';
      default: return status;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Gestión de Envíos</h1>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex space-x-2 mb-6">
        {[
          { key: 'all', label: 'Todos' },
          { key: 'pending', label: 'Pendientes' },
          { key: 'processing', label: 'Procesando' },
          { key: 'shipped', label: 'Enviados' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key as 'all' | 'pending' | 'processing' | 'shipped')}
            className={`px-4 py-2 rounded-lg ${
              filter === key
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tabla de órdenes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Orden
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Envío
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tracking
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center">
                  Cargando...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No hay órdenes para mostrar
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        #{order.id}
                      </div>
                      <div className="text-sm text-gray-500">
                        ${order.total.toLocaleString('es-AR')}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {order.customerName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.customerEmail}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-gray-900">
                        Envío #{order.shippingMethodId}
                      </div>
                      <div className="text-sm text-gray-500">
                        ${order.shippingCost}
                      </div>
                      {order.shippingMode && (
                        <div className="text-xs text-gray-400">
                          {order.shippingMode}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.shippingStatus)}`}>
                      {getStatusText(order.shippingStatus)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {order.trackingNumber || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="text-primary hover:text-primary/80 mr-3"
                    >
                      Gestionar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de gestión */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              Gestionar Envío - Orden #{selectedOrder.id}
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección de envío
                </label>
                    <div className="text-sm text-gray-600">
                      {String(selectedOrder.shippingAddress?.direccion || '')} {String(selectedOrder.shippingAddress?.numero || '')},
                      {String(selectedOrder.shippingAddress?.ciudad || '')}, {String(selectedOrder.shippingAddress?.provincia || '')}
                      <br />
                      CP: {String(selectedOrder.shippingAddress?.zipCode || '')}
                    </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado actual
                </label>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedOrder.shippingStatus)}`}>
                  {getStatusText(selectedOrder.shippingStatus)}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código de seguimiento
                </label>
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="Ingrese el código de seguimiento"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              {selectedOrder.shippingStatus === 'pending' && (
                <button
                  onClick={() => updateShippingStatus(selectedOrder.id, 'processing')}
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Marcar en proceso
                </button>
              )}
              
              {(selectedOrder.shippingStatus === 'pending' || selectedOrder.shippingStatus === 'processing') && (
                <button
                  onClick={() => updateShippingStatus(selectedOrder.id, 'shipped')}
                  disabled={updating || !trackingCode}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Marcar como enviado
                </button>
              )}

              {selectedOrder.shippingStatus === 'shipped' && (
                <button
                  onClick={() => updateShippingStatus(selectedOrder.id, 'delivered')}
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Marcar como entregado
                </button>
              )}

              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setTrackingCode('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
