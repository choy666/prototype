'use client';

import { useState } from 'react';
import { CheckCircle, Clock, Truck, Package, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { getCustomerTimelineStatus } from '@/lib/utils/order-status';

type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'processing' | 'failed' | 'returned';

interface TimelineStep {
  status: OrderStatus;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
  current: boolean;
}

interface OrderTimelineProps {
  currentStatus: OrderStatus;
  createdAt: string;
  trackingNumber?: string;
  trackingUrl?: string;
  mercadoLibreShipmentId?: string;
  orderId?: string;
}

const statusSteps: Omit<TimelineStep, 'completed' | 'current'>[] = [
  {
    status: 'pending',
    label: 'Pedido Recibido',
    description: 'Tu pedido ha sido recibido y está siendo procesado',
    icon: Clock,
  },
  {
    status: 'processing',
    label: 'En Procesamiento',
    description: 'Tu pedido está siendo preparado para envío',
    icon: Package,
  },
  {
    status: 'shipped',
    label: 'En Camino',
    description: 'Tu pedido ha sido enviado y está en camino',
    icon: Truck,
  },
  {
    status: 'delivered',
    label: 'Entregado',
    description: 'Tu pedido ha sido entregado exitosamente',
    icon: CheckCircle,
  },
];

export default function OrderTimeline({ 
  currentStatus, 
  createdAt, 
  trackingNumber, 
  trackingUrl, 
  mercadoLibreShipmentId, 
  orderId 
}: OrderTimelineProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Convertir el estado para el timeline del cliente
  const timelineStatus = getCustomerTimelineStatus(currentStatus);
  const statusOrder: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered'];
  const currentIndex = statusOrder.indexOf(timelineStatus as 'pending' | 'processing' | 'shipped' | 'delivered');

  const steps: TimelineStep[] = statusSteps.map((step, index) => ({
    ...step,
    completed: index < currentIndex,
    current: index === currentIndex,
  }));

  // Función para refrescar el estado del envío
  const refreshTracking = async () => {
    if (!mercadoLibreShipmentId || !orderId) return;
    
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/shipments?id=${mercadoLibreShipmentId}`);
      if (response.ok) {
        setLastUpdate(new Date());
        // Aquí podrías actualizar el estado del componente con los datos frescos
        // Por ahora, solo actualizamos la timestamp
      }
    } catch (error) {
      console.error('Error refreshing tracking:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Si el pedido está cancelado, mostrar estado especial
  if (currentStatus === 'cancelled') {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
            Pedido Cancelado
          </h3>
        </div>
        <p className="text-red-700 dark:text-red-300">
          Este pedido ha sido cancelado. Si tienes alguna pregunta, contacta con nuestro soporte.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Estado del Pedido
      </h3>

      {trackingNumber && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-800 dark:text-blue-200">
                Seguimiento Mercado Libre
              </span>
            </div>
            {mercadoLibreShipmentId && (
              <button
                onClick={refreshTracking}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            )}
          </div>
          
          <div className="space-y-2">
            <div>
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Número de Seguimiento:</span>
              <p className="text-blue-700 dark:text-blue-300 font-mono font-semibold">
                {trackingNumber}
              </p>
            </div>
            
            {trackingUrl && (
              <div>
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ver en Mercado Libre
                </a>
              </div>
            )}
            
            <div className="text-xs text-blue-600 dark:text-blue-400">
              Última actualización: {lastUpdate.toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.status} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    step.completed
                      ? 'bg-green-500 border-green-500 text-white'
                      : step.current
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-0.5 h-8 mt-2 ${
                      step.completed ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                )}
              </div>
              <div className="flex-1 pt-1">
                <h4
                  className={`font-medium ${
                    step.completed
                      ? 'text-green-700 dark:text-green-400'
                      : step.current
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step.label}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {step.description}
                </p>
                {step.current && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Actualizado: {new Date(createdAt).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
