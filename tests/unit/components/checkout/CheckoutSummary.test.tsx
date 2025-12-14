import React from 'react';
import { render, screen } from '@testing-library/react';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';
import { useCartStore } from '@/lib/stores/useCartStore';

// Mock del store del carrito
jest.mock('@/lib/stores/useCartStore');

const mockUseCartStore = useCartStore as jest.MockedFunction<typeof useCartStore>;

describe('CheckoutSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCartStore.mockReturnValue({
      items: [
        {
          id: 'product-1',
          name: 'Producto Test 1',
          price: 10000,
          quantity: 2,
          image: '/image1.jpg',
          discount: 10
        },
        {
          id: 'product-2',
          name: 'Producto Test 2',
          price: 5000,
          quantity: 1,
          image: '/image2.jpg'
        }
      ],
      addItem: jest.fn(),
      removeItem: jest.fn(),
      updateQuantity: jest.fn(),
      clearCart: jest.fn(),
      totalItems: 3,
      totalAmount: 25000
    } as any);
  });

  it('debe mostrar los productos del carrito con precios correctos', () => {
    const shippingMethod = {
      id: 'me2-standard',
      name: 'ME2 Standard',
      cost: 500
    };

    render(<CheckoutSummary selectedShippingMethod={shippingMethod} shippingAddress={{
      codigoPostal: '1001',
      provincia: 'Buenos Aires'
    }} />);

    // Verificar productos
    expect(screen.getByText('Producto Test 1')).toBeInTheDocument();
    expect(screen.getByText('Producto Test 2')).toBeInTheDocument();
    
    // Verificar precios con descuento
    expect(screen.getByText('$ 18.000,00')).toBeInTheDocument(); // 10000 * 2 * 0.9
    // Buscar el precio del producto 2 (el segundo elemento con ese precio)
    expect(screen.getAllByText('$ 5.000,00')[1]).toBeInTheDocument(); // 5000 * 1
  });

  it('debe mostrar el subtotal sin descuentos', () => {
    render(<CheckoutSummary selectedShippingMethod={null} shippingAddress={null} />);

    // Subtotal: (10000 * 2 * 0.9) + (5000 * 1) = 23000 (con descuentos)
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    // Usar el primer elemento de subtotal (el gris en la sección de resumen)
    expect(screen.getAllByText('$ 23.000,00')[0]).toBeInTheDocument();
  });

  it('debe mostrar el costo de envío cuando está seleccionado', () => {
    const shippingMethod = {
      id: 'me2-standard',
      name: 'ME2 Standard',
      cost: 500
    };

    render(<CheckoutSummary selectedShippingMethod={shippingMethod} shippingAddress={null} />);

    expect(screen.getByText('Envío')).toBeInTheDocument();
    expect(screen.getByText('$ 500,00')).toBeInTheDocument();
  });

  it('debe mostrar "Gratis" cuando el envío no tiene costo', () => {
    const shippingMethod = {
      id: 'free-shipping',
      name: 'Envío Gratis',
      cost: 0
    };

    render(<CheckoutSummary selectedShippingMethod={shippingMethod} shippingAddress={null} />);

    expect(screen.getByText('Envío')).toBeInTheDocument();
    expect(screen.getByText('Gratis')).toBeInTheDocument();
  });

  it('debe calcular el total correctamente con descuentos y envío', () => {
    const shippingMethod = {
      id: 'me2-standard',
      name: 'ME2 Standard',
      cost: 500
    };

    render(<CheckoutSummary selectedShippingMethod={shippingMethod} shippingAddress={null} />);

    // Total con descuentos: 18000 + 5000 + 500 = 23500
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$ 23.500,00')).toBeInTheDocument();
  });

  it('debe mostrar la dirección de envío cuando está disponible', () => {
    const shippingAddress = {
      codigoPostal: '1001',
      provincia: 'Buenos Aires'
    };

    render(<CheckoutSummary selectedShippingMethod={null} shippingAddress={shippingAddress} />);

    expect(screen.getByText('Dirección de envío')).toBeInTheDocument();
    expect(screen.getByText('1001')).toBeInTheDocument();
    expect(screen.getByText('Buenos Aires')).toBeInTheDocument();
  });

  it('debe mostrar mensaje cuando no hay dirección de envío', () => {
    render(<CheckoutSummary selectedShippingMethod={null} shippingAddress={null} />);

    expect(screen.getByText('Dirección de envío')).toBeInTheDocument();
    expect(screen.getByText('No seleccionada')).toBeInTheDocument();
  });

  it('debe mostrar el método de envío seleccionado', () => {
    const shippingMethod = {
      id: 'me2-priority',
      name: 'ME2 Prioritario',
      cost: 800
    };

    render(<CheckoutSummary selectedShippingMethod={shippingMethod} shippingAddress={null} />);

    expect(screen.getByText('Método de envío')).toBeInTheDocument();
    expect(screen.getByText('ME2 Prioritario')).toBeInTheDocument();
  });

  describe('cuando el carrito está vacío', () => {
    beforeEach(() => {
      mockUseCartStore.mockImplementation(() => ({
        items: [],
        addItem: jest.fn(),
        removeItem: jest.fn(),
        updateQuantity: jest.fn(),
        clearCart: jest.fn(),
        totalItems: 0,
        totalAmount: 0
      }));
    });

    it('debe mostrar carrito vacío cuando no hay productos', () => {
      render(<CheckoutSummary selectedShippingMethod={null} shippingAddress={null} />);

      expect(screen.getByTestId('empty-cart')).toBeInTheDocument();
      expect(screen.getByText('Tu carrito está vacío')).toBeInTheDocument();
    });
  });
});
