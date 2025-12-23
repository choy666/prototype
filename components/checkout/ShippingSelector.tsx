// components/checkout/ShippingSelector.tsx
// Componente para seleccionar método de envío en el checkout

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCart } from '../../hooks/useCart';
import { ShippingOption } from '@/lib/services/unified-shipping';

interface ShippingSelectorProps {
  onShippingSelected: (option: ShippingOption) => void;
  selectedAddress: {
    zipCode: string;
  } | null;
  className?: string;
}

export function ShippingSelector({ onShippingSelected, selectedAddress, className = '' }: ShippingSelectorProps) {
  const { items, subtotal } = useCart();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculateShipping = useCallback(async () => {
    if (!selectedAddress?.zipCode) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/shipping/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerZip: selectedAddress.zipCode,
          items: items.map((item: {
            id: number;
            quantity: number;
            price: number;
            weight?: number;
            dimensions?: {
              length: number;
              width: number;
              height: number;
            };
          }) => ({
            id: item.id.toString(),
            quantity: item.quantity,
            price: item.price,
            weight: item.weight,
            dimensions: item.dimensions
          })),
          subtotal
        })
      });

      if (!response.ok) {
        throw new Error('Error al calcular envío');
      }

      const data = await response.json();
      const shippingOptions = data.options;

      setOptions(shippingOptions);
      
      // Seleccionar la opción más económica por defecto
      if (shippingOptions.length > 0) {
        const cheapest = shippingOptions[0];
        setSelectedOption(cheapest);
        onShippingSelected(cheapest);
      }
    } catch (err) {
      setError('No pudimos calcular el envío. Intenta nuevamente.');
      console.error('Shipping calculation error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAddress?.zipCode, items, subtotal, onShippingSelected]);

  useEffect(() => {
    if (selectedAddress?.zipCode && items.length > 0) {
      calculateShipping();
    }
  }, [selectedAddress, items, calculateShipping]);

  const handleOptionSelect = (option: ShippingOption) => {
    setSelectedOption(option);
    onShippingSelected(option);
  };

  if (!selectedAddress?.zipCode) {
    return (
      <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
        <p className="text-gray-500">Selecciona una dirección para calcular el envío</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold">Método de envío</h3>
      
      {loading && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-2">Calculando envío...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && options.length > 0 && (
        <div className="space-y-3">
          {options.map((option) => (
            <label
              key={option.id}
              className={`
                flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors
                ${selectedOption?.id === option.id 
                  ? 'border-primary bg-primary/5' 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="shipping"
                  checked={selectedOption?.id === option.id}
                  onChange={() => handleOptionSelect(option)}
                  className="w-4 h-4 text-primary"
                />
                <div>
                  <p className="font-medium">{option.name}</p>
                  <p className="text-sm text-gray-500">
                    {option.estimated} {option.carrier && `• ${option.carrier}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {option.cost === 0 ? 'GRATIS' : `$${option.cost.toLocaleString('es-AR')}`}
                </p>
                {option.type === 'local' && (
                  <p className="text-xs text-green-600">Envío local</p>
                )}
              </div>
            </label>
          ))}
        </div>
      )}

      {!loading && !error && options.length === 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-700">
            No hay opciones de envío disponibles para este código postal.
          </p>
        </div>
      )}

      {selectedOption && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Envío seleccionado:</strong> {selectedOption.name}
            {selectedOption.cost > 0 && ` - $${selectedOption.cost.toLocaleString('es-AR')}`}
          </p>
        </div>
      )}
    </div>
  );
}
