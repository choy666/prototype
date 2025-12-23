// components/checkout/OrderSummary.tsx
// Componente para mostrar resumen del pedido

'use client';

interface OrderSummaryProps {
  items: {
    id: number;
    name: string;
    price: number;
    quantity: number;
  }[];
  subtotal: number;
  shippingCost: number;
  total: number;
  selectedShipping?: {
    name: string;
    estimated: string;
  };
}

export function OrderSummary({ 
  items, 
  subtotal, 
  shippingCost, 
  total, 
  selectedShipping 
}: OrderSummaryProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Resumen del pedido</h3>
      
      {/* Items */}
      <div className="space-y-3 mb-4">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-gray-500">Cantidad: {item.quantity}</p>
            </div>
            <p className="font-medium">
              ${(item.price * item.quantity).toLocaleString('es-AR')}
            </p>
          </div>
        ))}
      </div>
      
      {/* Totales */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>${subtotal.toLocaleString('es-AR')}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span>Envío</span>
          <span>
            {shippingCost === 0 
              ? 'GRATIS' 
              : `$${shippingCost.toLocaleString('es-AR')}`
            }
          </span>
        </div>
        
        <div className="flex justify-between font-semibold text-lg pt-2 border-t">
          <span>Total</span>
          <span>${total.toLocaleString('es-AR')}</span>
        </div>
      </div>
      
      {/* Info de envío seleccionado */}
      {selectedShipping && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Envío:</strong> {selectedShipping.name}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Entrega:</strong> {selectedShipping.estimated}
          </p>
        </div>
      )}
    </div>
  );
}
