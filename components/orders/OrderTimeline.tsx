'use client';

import { CheckCircle, Clock, Truck, Package, XCircle } from 'lucide-react';

type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

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
}

const statusSteps: Omit<TimelineStep, 'completed' | 'current'>[] = [
  {
    status: 'pending',
    label: 'Pedido Recibido',
    description: 'Tu pedido ha sido recibido y está siendo procesado',
    icon: Clock,
  },
  {
    status: 'paid',
    label: 'Pago Confirmado',
    description: 'El pago ha sido confirmado exitosamente',
    icon: CheckCircle,
  },
  {
    status: 'shipped',
    label: 'Enviado',
    description: 'Tu pedido ha sido enviado',
    icon: Truck,
  },
  {
    status: 'delivered',
    label: 'Entregado',
    description: 'Tu pedido ha sido entregado exitosamente',
    icon: Package,
  },
];

export default function OrderTimeline({ currentStatus, createdAt, trackingNumber }: OrderTimelineProps) {
  const statusOrder: OrderStatus[] = ['pending', 'paid', 'shipped', 'delivered'];
  const currentIndex = statusOrder.indexOf(currentStatus);

  const steps: TimelineStep[] = statusSteps.map((step, index) => ({
    ...step,
    completed: index < currentIndex,
    current: index === currentIndex,
  }));

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
        <div className="mb-6 p-4 bg-gray-900 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-blue-800 dark:text-blue-200">
              Número de Seguimiento
            </span>
          </div>
          <p className="text-blue-700 dark:text-blue-300 font-mono">
            {trackingNumber}
          </p>
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
