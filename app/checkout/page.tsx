'use client';

import { useEffect, useState } from 'react';
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
import { Address } from '@/lib/schema';
import { toast } from 'react-hot-toast';
import { MLShippingMethod } from '@/lib/types/shipping';

type CheckoutStep = 'address-selection' | 'shipping-form' | 'shipping-method' | 'new-address-form';

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const { items } = useCartStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('address-selection');
  const [selectedAddress, setSelectedAddress] = useState<Address & { id: number } | null>(null);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<MLShippingMethod | null>(null);
  const [shippingAddress, setShippingAddress] = useState<ShippingFormData | null>(null);
  const [documentType, setDocumentType] = useState<'DNI' | 'CUIT' | ''>('');
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [documentErrors, setDocumentErrors] = useState<{
    documentType?: string;
    documentNumber?: string;
  } | null>(null);

  // Cargar documento del usuario al montar
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await fetch('/api/user/document');
        if (!res.ok) return;
        const data = await res.json();

        setDocumentType((data.documentType as 'DNI' | 'CUIT' | null) ?? '');
        setDocumentNumber(data.documentNumber ?? '');
      } catch (error) {
        console.error('Error fetching user document:', error);
      }
    };

    fetchDocument();
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
        <h1 className="text-3xl font-bold mb-4 text-red-600">Inicio de Sesión Requerido</h1>
        <p className="mb-4 text-lg">Para proceder con el checkout y completar tu compra, es obligatorio iniciar sesión.</p>
        <p className="mb-6 text-gray-600">Puedes agregar productos al carrito sin iniciar sesión, pero para finalizar la compra necesitas una cuenta.</p>
        <div className="space-y-4">
          <Link href="/auth/signin">
            <Button size="lg" className="mr-4">Iniciar Sesión</Button>
          </Link>
          <Link href="/auth/signup">
            <Button variant="outline" size="lg">Crear Cuenta</Button>
          </Link>
        </div>
        <p className="mt-6 text-sm text-gray-500">
          ¿Ya tienes productos en el carrito? Se guardarán automáticamente al iniciar sesión.
        </p>
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
    // Primero intentar actualizar el documento del usuario
    try {
      setDocumentErrors(null);

      const payload = {
        documentType: documentType || null,
        documentNumber: documentNumber || null,
      };

      const res = await fetch('/api/user/document', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 400 && data.details) {
          const fieldErrors: { documentType?: string; documentNumber?: string } = {};
          for (const issue of data.details as Array<{ field: string; message: string }>) {
            if (issue.field === 'documentType') {
              fieldErrors.documentType = issue.message;
            }
            if (issue.field === 'documentNumber') {
              fieldErrors.documentNumber = issue.message;
            }
          }
          setDocumentErrors(fieldErrors);
          toast.error('Revisa los datos del documento');
          return;
        }

        throw new Error(data.error || 'Error al actualizar el documento');
      }

      // Actualizar estado con valores normalizados desde el backend
      setDocumentType((data.documentType as 'DNI' | 'CUIT' | null) ?? '');
      setDocumentNumber(data.documentNumber ?? '');
      setDocumentErrors(null);

      // Si el documento es válido (o se limpió), avanzar al siguiente paso
      setShippingAddress(shippingData);
      setCurrentStep('shipping-method');
    } catch (error) {
      console.error('Error updating user document:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Error al actualizar el documento del usuario'
      );
    }
  };

  const handleDocumentChange = (type: string, number: string) => {
    setDocumentType((type as 'DNI' | 'CUIT' | '') || '');
    setDocumentNumber(number);
    setDocumentErrors(null);
  };

  const handleShippingMethodSelect = (method: MLShippingMethod) => {
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
          weight: item.weight ?? undefined,
          variantId: item.variantId ?? undefined,
        })),
        shippingAddress,
        shippingMethod: {
          id: selectedShippingMethod.shipping_method_id.toString(),
          name: selectedShippingMethod.name,
          cost: selectedShippingMethod.cost,
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
      // Checkout Pro siempre usa init_point (producción) incluso con credenciales de test
      const paymentUrl = data.paymentUrl || data.initPoint || data.init_point;
      console.log('Usando Checkout Pro URL:', paymentUrl);
      if (paymentUrl) {
        // Redirigir a Mercado Pago
        window.location.href = paymentUrl;
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
              documentType={documentType}
              documentNumber={documentNumber}
              onDocumentChange={handleDocumentChange}
              documentErrors={documentErrors}
            />
          )}

          {currentStep === 'shipping-method' && (
            <div className="space-y-6">
              <ShippingMethodSelector
                selectedMethod={selectedShippingMethod}
                onMethodSelect={handleShippingMethodSelect}
                items={items}
                zipcode={shippingAddress?.codigoPostal || ''}
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
            selectedShippingMethod={selectedShippingMethod ? {
              id: selectedShippingMethod.shipping_method_id.toString(),
              name: selectedShippingMethod.name,
              cost: selectedShippingMethod.cost
            } : null}
            shippingAddress={shippingAddress}
          />
        </div>
      </div>
    </div>
  );
}
