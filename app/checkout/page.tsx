'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/lib/stores/useCartStore';
import { ShippingForm } from '@/components/checkout/ShippingForm';
import { AddressSelector } from '@/components/checkout/AddressSelector';
import { AddressForm } from '@/components/checkout/AddressForm';
import { ShippingMethodSelector } from '@/components/checkout/ShippingMethodSelector';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ShippingFormData, Address as ValidationAddress } from '@/lib/validations/checkout';
import { Address, ShippingMethod } from '@/lib/schema';
import { toast } from 'react-hot-toast';

type CheckoutStep = 'address-selection' | 'shipping-form' | 'shipping-method' | 'new-address-form';

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const { items } = useCartStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('address-selection');
  const [selectedAddress, setSelectedAddress] = useState<Address & { id: number } | null>(null);
  const [shippingMethodsList, setShippingMethodsList] = useState<ShippingMethod[]>([]);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod | null>(null);
  const [shippingAddress, setShippingAddress] = useState<ShippingFormData | null>(null);

  // Cargar métodos de envío al montar el componente
  useEffect(() => {
    const loadShippingMethods = async () => {
      try {
        const response = await fetch('/api/shipping-methods');
        if (response.ok) {
          const methods = await response.json();
          setShippingMethodsList(methods);
        } else {
          throw new Error('Error al cargar métodos de envío');
        }
      } catch (error) {
        console.error('Error loading shipping methods:', error);
        toast.error('Error al cargar métodos de envío');
      }
    };

    loadShippingMethods();
  }, []);

  // Verificar autenticación
  if (status === 'loading') {
    return (
      <div className="container mx-auto p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4">Cargando...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Acceso requerido</h1>
        <p className="mb-6">Debes iniciar sesión para continuar con el checkout.</p>
        <Link href="/auth/signin">
          <Button>Iniciar Sesión</Button>
        </Link>
      </div>
    );
  }

  // Verificar que no sea admin
  if (session.user.role === 'admin') {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Acceso denegado</h1>
        <p className="mb-6">Los administradores no pueden realizar compras.</p>
        <Link href="/admin">
          <Button>Ir al Panel de Administración</Button>
        </Link>
      </div>
    );
  }

  // Verificar que el carrito no esté vacío
  if (items.length === 0) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Tu carrito está vacío</h1>
        <p className="mb-6">Agrega productos a tu carrito antes de proceder al checkout.</p>
        <Link href="/products">
          <Button>Ver Productos</Button>
        </Link>
      </div>
    );
  }

  const handleAddressSelect = (address: Address | null) => {
    setSelectedAddress(address);
    if (address) {
      // Si selecciona una dirección guardada, ir al formulario de envío con datos pre-llenados
      setCurrentStep('shipping-form');
    } else {
      // Si elige "usar dirección diferente", mostrar formulario vacío
      setCurrentStep('shipping-form');
    }
  };

  const handleNewAddress = () => {
    setCurrentStep('new-address-form');
  };

  const handleAddressFormSubmit = async (addressData: ValidationAddress) => {
    try {
      const response = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addressData),
      });

      if (response.ok) {
        const newAddress = await response.json();
        setSelectedAddress(newAddress);
        setCurrentStep('shipping-form');
        toast.success('Dirección guardada correctamente');
      } else {
        toast.error('Error al guardar la dirección');
      }
    } catch (error) {
      console.error('Error saving address:', error);
      toast.error('Error al guardar la dirección');
    }
  };

  const handleShippingSubmit = async (shippingData: ShippingFormData) => {
    setShippingAddress(shippingData);
    setCurrentStep('shipping-method');
  };

  const handleShippingMethodSelect = (method: ShippingMethod) => {
    setSelectedShippingMethod(method);
  };

  const handleCheckoutSubmit = async () => {
    if (!shippingAddress || !selectedShippingMethod) {
      toast.error('Faltan datos de envío o método de envío');
      return;
    }

    setIsProcessing(true);

    try {
      // Preparar datos para el checkout
      const checkoutData = {
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          discount: item.discount,
          weight: item.weight,
          variantId: item.variantId,
        })),
        shippingAddress,
        shippingMethod: {
          id: selectedShippingMethod.id,
          name: selectedShippingMethod.name,
        },
        userId: session.user.id,
      };

      // Enviar a la API de checkout
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar el checkout');
      }

      if (data.init_point) {
        // Redirigir a Mercado Pago
        window.location.href = data.init_point;
      } else {
        throw new Error('No se recibió la URL de pago');
      }
    } catch (error) {
      console.error('Error during checkout:', error);
      toast.error(error instanceof Error ? error.message : 'Error al procesar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Checkout</h1>
        <p className="text-gray-600">Completa tu pedido</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Formulario de envío */}
        <div className="order-2 lg:order-1">
          {currentStep === 'address-selection' && (
            <AddressSelector
              onAddressSelect={handleAddressSelect}
              onNewAddress={handleNewAddress}
              selectedAddressId={selectedAddress?.id}
            />
          )}

          {currentStep === 'new-address-form' && (
            <AddressForm
              onSubmit={handleAddressFormSubmit}
              onCancel={() => setCurrentStep('address-selection')}
              submitLabel="Guardar y Continuar"
            />
          )}

          {currentStep === 'shipping-form' && (
            <ShippingForm
              onSubmit={handleShippingSubmit}
              isLoading={isProcessing}
              initialData={selectedAddress ? {
                nombre: selectedAddress.nombre,
                direccion: selectedAddress.direccion,
                ciudad: selectedAddress.ciudad,
                provincia: selectedAddress.provincia,
                codigoPostal: selectedAddress.codigoPostal,
                telefono: selectedAddress.telefono,
              } : undefined}
            />
          )}

          {currentStep === 'shipping-method' && (
            <div className="space-y-6">
              <ShippingMethodSelector
                shippingMethods={shippingMethodsList}
                selectedMethod={selectedShippingMethod}
                onMethodSelect={handleShippingMethodSelect}
                items={items}
                province={shippingAddress?.provincia || ''}
                subtotal={items.reduce((acc, item) => {
                  const basePrice = item.price;
                  const finalPrice = item.discount && item.discount > 0
                    ? basePrice * (1 - item.discount / 100)
                    : basePrice;
                  return acc + finalPrice * item.quantity;
                }, 0)}
              />

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('shipping-form')}
                  disabled={isProcessing}
                >
                  ← Volver
                </Button>
                <Button
                  onClick={handleCheckoutSubmit}
                  disabled={isProcessing || !selectedShippingMethod}
                >
                  {isProcessing ? 'Procesando...' : 'Continuar al Pago'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Resumen del pedido */}
        <div className="order-1 lg:order-2">
          <CheckoutSummary
            selectedShippingMethod={selectedShippingMethod}
            shippingAddress={shippingAddress}
          />
        </div>
      </div>
    </div>
  );
}
