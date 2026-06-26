import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ShippingMethodSelector } from '@/components/checkout/ShippingMethodSelector';
import { toast } from 'react-hot-toast';

// Mock de react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    error: jest.fn(),
  },
}));

// Mock de fetch para simular la API de envíos
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const createMockShippingResponse = (includePickupOptions?: boolean) => ({
  success: true,
  methods: [
    {
      shipping_method_id: 1,
      name: 'Envío a domicilio',
      description: 'Envío estándar a domicilio',
      cost: 500,
      currency_id: 'ARS',
      deliver_to: 'address' as const,
    },
    ...(includePickupOptions
      ? [
          {
            shipping_method_id: 2,
            name: 'Retiro en sucursal',
            description: 'Retiro en sucursal de correo',
            cost: 300,
            currency_id: 'ARS',
            deliver_to: 'agency' as const,
          },
        ]
      : []),
  ],
  fallback: false,
});

describe('ShippingMethodSelector', () => {
  const defaultProps = {
    items: [
      { id: 1, name: 'Producto 1', price: 1000, quantity: 1 },
    ],
    zipcode: '1001',
    subtotal: 1000,
    selectedMethod: null,
    onMethodSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  it('debería mostrar métodos de envío cuando pickup no está disponible', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockShippingResponse(false),
    } as unknown as Response);

    render(<ShippingMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Envío a domicilio')).toBeInTheDocument();
      expect(screen.queryByText('Retiro en sucursal')).not.toBeInTheDocument();
    });

    // No debe mostrar el selector de agencias
    expect(screen.queryByText('Selecciona una sucursal')).not.toBeInTheDocument();
  });

  it('debería ocultar opciones de retiro aunque el backend las incluya', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockShippingResponse(true),
    } as unknown as Response);

    render(<ShippingMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Envío a domicilio')).toBeInTheDocument();
      expect(screen.queryByText('Retiro en sucursal')).not.toBeInTheDocument();
    });
  });

  it('debería limpiar pickup al cambiar de zipcode', async () => {
    const { rerender } = render(
      <ShippingMethodSelector {...defaultProps} zipcode="1001" />
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockShippingResponse(true),
    } as unknown as Response);

    await waitFor(() => {
      expect(screen.queryByText('Retiro en sucursal')).not.toBeInTheDocument();
    });

    // Cambiar zipcode
    rerender(<ShippingMethodSelector {...defaultProps} zipcode="2000" />);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockShippingResponse(false),
    } as unknown as Response);

    await waitFor(() => {
      expect(screen.queryByText('Retiro en sucursal')).not.toBeInTheDocument();
    });
  });

  it('debería manejar errores de la API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Error en la API' }),
    } as unknown as Response);

    render(<ShippingMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('No se pudieron cargar los métodos de envío');
    });
  });

  it('debería usar fallback cuando pickup es undefined', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockShippingResponse(false),
    } as unknown as Response);

    render(<ShippingMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Envío a domicilio')).toBeInTheDocument();
      expect(screen.queryByText('Retiro en sucursal')).not.toBeInTheDocument();
    });
  });
});
