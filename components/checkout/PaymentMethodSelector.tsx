// components/checkout/PaymentMethodSelector.tsx
// Componente para seleccionar método de pago

'use client';

export function PaymentMethodSelector() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Método de pago</h3>
      
      <div className="p-4 border border-gray-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <input
            type="radio"
            name="payment"
            checked
            readOnly
            className="w-4 h-4 text-primary"
          />
          <div>
            <p className="font-medium">Mercado Pago</p>
            <p className="text-sm text-gray-500">
              Paga con tarjeta, débito o efectivo
            </p>
          </div>
        </div>
      </div>
      
      <p className="text-sm text-gray-600">
        Al continuar serás redirigido a Mercado Pago para completar el pago de forma segura.
      </p>
    </div>
  );
}
