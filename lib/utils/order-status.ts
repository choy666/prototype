/**
 * Utilidades para manejo de estados de pedidos
 */

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'rejected' | 'processing' | 'failed' | 'returned';

/**
 * Obtiene la etiqueta del estado para el panel de administración
 */
export function getAdminStatusLabel(status: OrderStatus): string {
  const statusLabels = {
    pending: 'Pendiente',
    paid: 'Pagado',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
    rejected: 'Rechazado',
    processing: 'En Procesamiento',
    failed: 'Fallido',
    returned: 'Devuelto',
  };
  return statusLabels[status] || status;
}

/**
 * Obtiene la etiqueta del estado para la vista del cliente
 * Convierte "paid" a "En Procesamiento" para mejor experiencia del usuario
 */
export function getCustomerStatusLabel(status: OrderStatus): string {
  const customerStatusLabels = {
    pending: 'Pendiente',
    paid: 'En Procesamiento',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
    rejected: 'Rechazado',
    processing: 'En Procesamiento',
    failed: 'Fallido',
    returned: 'Devuelto',
  };
  return customerStatusLabels[status] || status;
}

/**
 * Obtiene el estado del timeline para el cliente
 * Convierte "paid" a "processing" para el timeline
 */
export function getCustomerTimelineStatus(status: OrderStatus): 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'rejected' | 'failed' | 'returned' {
  if (status === 'paid') {
    return 'processing';
  }
  return status;
}

/**
 * Obtiene las clases CSS para el badge de estado del cliente
 */
export function getCustomerStatusColorClass(status: OrderStatus): string {
  const statusColors = {
    pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
    paid: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400', // "En Procesamiento" usa azul
    shipped: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400',
    delivered: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
    cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
    rejected: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
    processing: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
    failed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
    returned: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400',
  };
  return statusColors[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
}

/**
 * Obtiene las clases CSS para el badge de estado del admin
 */
export function getAdminStatusColorClass(status: OrderStatus): string {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    rejected: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    returned: 'bg-orange-100 text-orange-800',
  };
  return statusColors[status] || 'bg-gray-100 text-gray-800';
}
