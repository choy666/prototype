import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShippingMethodSelector } from '@/components/checkout/ShippingMethodSelector';
import { MLShippingMethod } from '@/lib/types/shipping';
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

const createMockShippingResponse = (pickup?: { available: boolean; types: ('agency' | 'place')[] }) => ({
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
    ...(pickup?.available
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
  pickup,
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
      json: async () => createMockShippingResponse({ available: false, types: [] }),
    });

    render(<ShippingMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Envío a domicilio')).toBeInTheDocument();
      expect(screen.queryByText('Retiro en sucursal')).not.toBeInTheDocument();
    });

    // No debe mostrar el selector de agencias
    expect(screen.queryByText('Selecciona una sucursal')).not.toBeInTheDocument();
  });

  it('debería mostrar opción de retiro cuando pickup incluye agency', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockShippingResponse({ available: true, types: ['agency'] }),
    });

    render(<ShippingMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Envío a domicilio')).toBeInTheDocument();
      expect(screen.getByText('Retiro en sucursal')).toBeInTheDocument();
    });

    // Al seleccionar retiro, debe mostrar el selector de agencias
    const agencyOption = screen.getByText('Retiro en sucursal');
    fireEvent.click(agencyOption);

    // El selector de agencias debería aparecer
    await waitFor(() => {
      expect(defaultProps.onMethodSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          deliver_to: 'agency',
          name: 'Retiro en sucursal',
        })
      );
    });
  });

  it('debería mostrar opción de retiro cuando pickup incluye place', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockShippingResponse({ available: true, types: ['place'] }),
    });

    render(<ShippingMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Envío a domicilio')).toBeInTheDocument();
      expect(screen.getByText('Retiro en punto de retiro')).toBeInTheDocument();
    });
  });

  it('debería mostrar ambas opciones de retiro cuando pickup incluye agency y place', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockShippingResponse({ available: true, types: ['agency', 'place'] }),
    });

    render(<ShippingMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Envío a domicilio')).toBeInTheDocument();
      expect(screen.getByText('Retiro en sucursal')).toBeInTheDocument();
      expect(screen.getByText('Retiro en punto de retiro')).toBeInTheDocument();
    });
  });

  it('debería limpiar pickup al cambiar de zipcode', async () => {
    const { rerender } = render(
      <ShippingMethodSelector {...defaultProps} zipcode="1001" />
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockShippingResponse({ available: true, types: ['agency'] }),
    });

    await waitFor(() => {
      expect(screen.getByText('Retiro en sucursal')).toBeInTheDocument();
    });

    // Cambiar zipcode
    rerender(<ShippingMethodSelector {...defaultProps} zipcode="2000" />);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockShippingResponse({ available: false, types: [] }),
    });

    await waitFor(() => {
      expect(screen.queryByText('Retiro en sucursal')).not.toBeInTheDocument();
    });
  });

  it('debería manejar errores de la API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Error en la API' }),
    });

    render(<ShippingMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('No se pudieron cargar los métodos de envío');
    });
  });

  it('debería usar fallback cuando pickup es undefined', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockShippingResponse(undefined),
    });

    render(<ShippingMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Envío a domicilio')).toBeInTheDocument();
      expect(screen.queryByText('Retiro en sucursal')).not.toBeInTheDocument();
    });
  });
});
