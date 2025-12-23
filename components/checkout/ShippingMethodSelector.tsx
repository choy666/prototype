'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { MLShippingMethod } from '@/lib/types/shipping';


interface ShippingMethodSelectorProps {
  selectedMethod?: MLShippingMethod | null;
  onMethodSelect: (method: MLShippingMethod) => void;
  items: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    discount?: number;
  }>;
  zipcode: string;
  subtotal: number;
}

export function ShippingMethodSelector({
  selectedMethod,
  onMethodSelect,
  items,
  zipcode,
  subtotal,
}: ShippingMethodSelectorProps) {
  const [shippingMethods, setShippingMethods] = useState<MLShippingMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [source, setSource] = useState<string | null>(null);

  const handleMethodSelect = (method: MLShippingMethod) => {
    onMethodSelect(method);
  };

  // Obtener métodos de envío de la API ML cuando cambia el zipcode o items
  useEffect(() => {
    if (!zipcode || items.length === 0) {
      setShippingMethods([]);
      return;
    }

    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const win = window as Window & { __mlShippingFetches?: Set<string> };
      const guardKey = `ml-shipping-${zipcode}-${items
        .map((item) => `${item.id}:${item.quantity}`)
        .join(',')}-${subtotal}`;

      if (!win.__mlShippingFetches) {
        win.__mlShippingFetches = new Set<string>();
      }

      if (win.__mlShippingFetches.has(guardKey)) {
        return;
      }

      win.__mlShippingFetches.add(guardKey);
    }

    const fetchShippingMethods = async () => {
      setIsLoading(true);
      setIsFallback(false);
      setSource(null);
      try {
        const response = await fetch('/api/shipping/unified', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerZip: zipcode,
            items: items.map(item => ({
              id: item.id.toString(),
              quantity: item.quantity,
              price: item.discount && item.discount > 0
                ? item.price * (1 - item.discount / 100)
                : item.price
            })),
            logisticType: 'me2'
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[ShippingMethodSelector] Datos recibidos de API:', {
            options: data.options,
            length: data.options?.length
          });

          if (data.options && Array.isArray(data.options)) {
            // Convertir opciones unificadas al formato esperado
            const convertedMethods = data.options.map((option: {
              id: string;
              name: string;
              cost: number;
              estimated: string;
              carrier?: string;
              type: string;
            }) => ({
              shipping_method_id: option.id,
              name: option.name,
              cost: option.cost,
              description: `${option.estimated} ${option.carrier ? `• ${option.carrier}` : ''}`,
              shipping_mode: option.type || 'me2',
              deliver_to: 'address',
              type: option.type,
              estimated_delivery: option.estimated ? {
                date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // Estimado 3 días
              } : undefined
            }));
            
            setShippingMethods(convertedMethods);
            setIsFallback(convertedMethods.some((m: {
              type: string;
            }) => m.type === 'local'));
            setSource(convertedMethods.some((m: {
              type: string;
            }) => m.type === 'local') ? 'unified_shipping' : 'me2');
          } else {
            console.error('[ShippingMethodSelector] Error en respuesta:', data);
            throw new Error('Error al obtener métodos de envío');
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error en la API de envíos');
        }
      } catch (error) {
        console.error('Error fetching shipping methods:', error);
        toast.error('No se pudieron cargar los métodos de envío');
        setShippingMethods([]);
        setIsFallback(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShippingMethods();
  }, [zipcode, items, subtotal]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600">Cargando métodos de envío...</p>
      </div>
    );
  }

  if (shippingMethods.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600">No hay métodos de envío disponibles para este código postal</p>
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
        <p className="text-xs text-gray-500">
          {source === 'unified_shipping'
            ? 'Mostrando métodos de envío combinados (Mercado Libre + Tiendanube).'
            : source === 'internal_shipping'
              ? 'Mostrando método de envío local provisto por la tienda.'
              : isFallback
                ? 'Mostrando métodos de envío locales (fallback) porque la API de Mercado Libre no está disponible. Los costos son estimados.'
                : 'Mostrando métodos de envío disponibles.'}
        </p>
      </div>

      <div className="space-y-3">
        {shippingMethods.map((method, index) => {
          const isSelected = selectedMethod?.shipping_method_id === method.shipping_method_id;

          const baseId =
            (typeof method.shipping_method_id !== 'undefined'
              ? method.shipping_method_id.toString()
              : 'no-id') +
            '-' +
            (typeof method.order_priority !== 'undefined'
              ? method.order_priority.toString()
              : index.toString());

          const inputId = `shipping-${baseId}`;

          return (
            <div
              key={baseId}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-gray-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                handleMethodSelect(method);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id={inputId}
                    name="shipping-method"
                    checked={isSelected}
                    onChange={() => {
                      handleMethodSelect(method);
                    }}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor={inputId}
                    className="font-medium cursor-pointer"
                  >
                    {method.name}
                  </label>
                </div>

                <div className="text-right">
                  {method.cost === 0 ? (
                    <span className="text-green-600 font-semibold">Gratis</span>
                  ) : (
                    <span className="font-semibold">{formatCurrency(method.cost)}</span>
                  )}
                </div>
              </div>

              {/* Información adicional del método */}
              <div className="mt-2 ml-7">
                <div className="text-xs text-gray-500 space-y-1">
                  <p>{method.description}</p>
                  {method.type === 'internal' && (
                    <p className="text-green-600 font-semibold">
                      ⚡ Entrega en 24 horas hábiles
                    </p>
                  )}
                  {method.estimated_delivery && (
                    <p>
                      Entrega estimada: {new Date(method.estimated_delivery.date).toLocaleDateString('es-AR')}
                    </p>
                  )}
                  <p>Modo: {method.shipping_mode}</p>
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
              {selectedMethod.cost === 0 ? 'Gratis' : formatCurrency(selectedMethod.cost)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
