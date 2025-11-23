'use client';

import { useState, useEffect } from 'react';
import { ShippingMethod } from '@/lib/schema';
import { calculateShippingCost, calculateTotalWeight, isFreeShipping } from '@/lib/utils/shipping';
import { Label } from '@/components/ui/label';

interface ShippingMethodSelectorProps {
  shippingMethods: ShippingMethod[];
  selectedMethod?: ShippingMethod | null;
  onMethodSelect: (method: ShippingMethod) => void;
  items: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    weight?: number | null;
    discount?: number | null;
  }>;
  province: string;
  subtotal: number;
}

export function ShippingMethodSelector({
  shippingMethods,
  selectedMethod,
  onMethodSelect,
  items,
  province,
  subtotal,
}: ShippingMethodSelectorProps) {
  const [calculatedCosts, setCalculatedCosts] = useState<Record<number, number>>({});

  // Calcular costos para todos los métodos cuando cambian las props
  useEffect(() => {
    // Normalizar valores null a undefined para compatibilidad con CartItem
    const normalizedItems = items.map(item => ({
      ...item,
      discount: item.discount ?? undefined
    }));
    
    const totalWeight = calculateTotalWeight(normalizedItems);
    const costs: Record<number, number> = {};

    shippingMethods.forEach(method => {
      costs[method.id] = calculateShippingCost(method, totalWeight, province, subtotal);
    });

    setCalculatedCosts(costs);
  }, [shippingMethods, items, province, subtotal]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

  if (shippingMethods.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600">No hay métodos de envío disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Método de Envío</h3>
        <p className="text-sm text-gray-600 mb-4">
          Selecciona cómo quieres recibir tu pedido
        </p>
      </div>

      <div className="space-y-3">
        {shippingMethods.map((method) => {
          const cost = calculatedCosts[method.id] || 0;
          const isFree = isFreeShipping(method, subtotal);
          const isSelected = selectedMethod?.id === method.id;

          return (
            <div
              key={method.id}
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-gray-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onMethodSelect(method)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id={`shipping-${method.id}`}
                    name="shipping-method"
                    checked={isSelected}
                    onChange={() => onMethodSelect(method)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <Label
                    htmlFor={`shipping-${method.id}`}
                    className="font-medium cursor-pointer"
                  >
                    {method.name}
                  </Label>
                </div>

                <div className="text-right">
                  {isFree ? (
                    <span className="text-green-600 font-semibold">Gratis</span>
                  ) : (
                    <span className="font-semibold">{formatCurrency(cost)}</span>
                  )}
                </div>
              </div>

              {/* Información adicional del método */}
              <div className="mt-2 ml-7">
                <div className="text-xs text-gray-500 space-y-1">
                  {method.freeThreshold && (
                    <p>
                      Envío gratis en compras superiores a {formatCurrency(Number(method.freeThreshold))}
                    </p>
                  )}
                  <p>Tiempo de entrega: 7-10 días hábiles</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedMethod && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Costo de envío:</span>
            <span className="text-sm font-semibold">
              {calculatedCosts[selectedMethod.id] === 0 ? 'Gratis' : formatCurrency(calculatedCosts[selectedMethod.id] || 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
