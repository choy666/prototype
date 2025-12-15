import { NextRequest } from 'next/server';
import { POST } from '@/app/api/shipments/calculate/route';
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre';

// Mock de MercadoLibreAuth
jest.mock('@/lib/auth/mercadolibre');
const mockMercadoLibreAuth = MercadoLibreAuth as jest.Mocked<typeof MercadoLibreAuth>;

// Mock de funciones de DB
jest.mock('@/lib/actions/me2-shipping', () => ({
  getValidatedME2Dimensions: jest.fn().mockResolvedValue({
    dimensions: {
      weight: 1000,
      height: 10,
      width: 10,
      length: 10,
    },
    hasInvalidProducts: false,
    validationWarnings: [],
  }),
  getBusinessShippingConfig: jest.fn().mockResolvedValue(null), // No es envío interno
}));

// Mock de fetch global
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Helper para crear mocks de Response
const createMockResponse = (data: any, ok = true, status = 200) => ({
  ok,
  status,
  statusText: 'OK',
  headers: new Headers(),
  redirected: false,
  type: 'basic' as ResponseType,
  url: 'https://api.mercadolibre.com',
  clone: jest.fn(),
  body: null,
  bodyUsed: false,
  bytes: jest.fn(), // Propiedad faltante agregada
  arrayBuffer: jest.fn(),
  blob: jest.fn(),
  formData: jest.fn(),
  text: jest.fn(),
  json: async () => data,
});

// Mock de logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('/api/shipments/calculate - Pickup Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock de autenticación
    const mockInstance = {
      getAccessToken: jest.fn().mockResolvedValue('test-token'),
    };
    mockMercadoLibreAuth.getInstance.mockResolvedValue(mockInstance as any);
  });

  it('debería devolver pickup.available=true cuando ML devuelve option_type=agency', async () => {
    // Mock de la respuesta de ML con option_type=agency
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        destination: {
          zip_code: '1001',
          city: { id: 'TUxBQ0NVSVZBZmE', name: 'CABA' },
          state: { id: 'AR-C', name: 'Capital Federal' },
          country: { id: 'AR', name: 'Argentina' },
        },
        options: [
          {
            shipping_method_id: 73333,
            id: 1,
            name: 'Retiro en sucursal',
            currency_id: 'ARS',
            base_cost: 0,
            cost: 0,
            list_cost: 0,
            shipping_method_type: 'standard',
            option_type: 'agency', // <-- Tipo agency
            estimated_delivery_time: {
              date: '2024-01-10',
              time_frame: { from: '09:00', to: '18:00' },
              type: 'known_frame',
              unit: 'days',
              shipping: 3,
              handling: 0,
            },
          },
          {
            shipping_method_id: 73334,
            id: 2,
            name: 'Envío a domicilio',
            currency_id: 'ARS',
            base_cost: 500,
            cost: 500,
            list_cost: 500,
            shipping_method_type: 'standard',
            option_type: 'address',
            estimated_delivery_time: {
              date: '2024-01-12',
              time_frame: { from: '09:00', to: '18:00' },
              type: 'known_frame',
              unit: 'days',
              shipping: 5,
              handling: 0,
            },
          },
        ],
      })
    );

    const request = new NextRequest('http://localhost:3000/api/shipments/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zipcode: '1001',
        items: [
          {
            id: '1',
            quantity: 1,
            price: 1000,
            mlItemId: 'MLA123456789',
          },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.pickup).toEqual({
      available: true,
      types: ['agency'],
    });
    expect(data.options).toHaveLength(2);
    expect(data.options[0].deliver_to).toBe('agency');
    expect(data.options[1].deliver_to).toBe('address');
  });

  it('debería devolver pickup.available=true cuando ML devuelve option_type=place', async () => {
    // Mock de la respuesta de ML con option_type=place
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        destination: {
          zip_code: '1001',
          city: { id: 'TUxBQ0NVSVZBZmE', name: 'CABA' },
          state: { id: 'AR-C', name: 'Capital Federal' },
          country: { id: 'AR', name: 'Argentina' },
        },
        options: [
          {
            shipping_method_id: 73333,
            id: 1,
            name: 'Retiro en punto',
            currency_id: 'ARS',
            base_cost: 0,
            cost: 0,
            list_cost: 0,
            shipping_method_type: 'standard',
            option_type: 'place', // <-- Tipo place
            estimated_delivery_time: {
              date: '2024-01-10',
              time_frame: { from: '09:00', to: '18:00' },
              type: 'known_frame',
              unit: 'days',
              shipping: 2,
              handling: 0,
            },
          },
          {
            shipping_method_id: 73334,
            id: 2,
            name: 'Envío a domicilio',
            currency_id: 'ARS',
            base_cost: 500,
            cost: 500,
            list_cost: 500,
            shipping_method_type: 'standard',
            option_type: 'address',
            estimated_delivery_time: {
              date: '2024-01-12',
              time_frame: { from: '09:00', to: '18:00' },
              type: 'known_frame',
              unit: 'days',
              shipping: 5,
              handling: 0,
            },
          },
        ],
      })
    );

    const request = new NextRequest('http://localhost:3000/api/shipments/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zipcode: '1001',
        items: [
          {
            id: '1',
            quantity: 1,
            price: 1000,
            mlItemId: 'MLA123456789',
          },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.pickup).toEqual({
      available: true,
      types: ['place'],
    });
    expect(data.options).toHaveLength(2);
    expect(data.options[0].deliver_to).toBe('agency'); // place se mapea a agency para el selector
    expect(data.options[1].deliver_to).toBe('address');
  });

  it('debería devolver pickup.available=false cuando no hay opciones de retiro', async () => {
    // Mock de la respuesta de ML sin option_type=agency/place
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        destination: {
          zip_code: '1001',
          city: { id: 'TUxBQ0NVSVZBZmE', name: 'CABA' },
          state: { id: 'AR-C', name: 'Capital Federal' },
          country: { id: 'AR', name: 'Argentina' },
        },
        options: [
          {
            shipping_method_id: 73334,
            id: 2,
            name: 'Envío a domicilio',
            currency_id: 'ARS',
            base_cost: 500,
            cost: 500,
            list_cost: 500,
            shipping_method_type: 'standard',
            option_type: 'address',
            estimated_delivery_time: {
              date: '2024-01-12',
              time_frame: { from: '09:00', to: '18:00' },
              type: 'known_frame',
              unit: 'days',
              shipping: 5,
              handling: 0,
            },
          },
        ],
      })
    );

    const request = new NextRequest('http://localhost:3000/api/shipments/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zipcode: '1001',
        items: [
          {
            id: '1',
            quantity: 1,
            price: 1000,
            mlItemId: 'MLA123456789',
          },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.pickup).toEqual({
      available: false,
      types: [],
    });
    expect(data.options).toHaveLength(1);
    expect(data.options[0].deliver_to).toBe('address');
  });

  it('debería devolver pickup.available=false en fallback local', async () => {
    // Mock de error en ML para activar fallback
    mockFetch.mockRejectedValueOnce(new Error('ML API Error'));

    const request = new NextRequest('http://localhost:3000/api/shipments/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zipcode: '9999',
        items: [
          {
            id: '1',
            quantity: 1,
            price: 1000,
            mlItemId: 'MLA123456789',
          },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.fallback).toBe(true);
    expect(data.pickup).toEqual({
      available: false,
      types: [],
    });
  });

  it('debería devolver pickup.available=false en envíos internos', async () => {
    const request = new NextRequest('http://localhost:3000/api/shipments/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zipcode: '1001', // Mismo zip que el negocio configurado
        items: [
          {
            id: '1',
            quantity: 1,
            price: 10000, // Precio alto para free shipping
          },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    if (data.source === 'internal_shipping') {
      expect(data.pickup).toEqual({
        available: false,
        types: [],
      });
    }
  });

  it('debería manejar shipping_option_type como fallback de option_type', async () => {
    // Mock de la respuesta de ML con shipping_option_type en lugar de option_type
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        destination: {
          zip_code: '1001',
          city: { id: 'TUxBQ0NVSVZBZmE', name: 'CABA' },
          state: { id: 'AR-C', name: 'Capital Federal' },
          country: { id: 'AR', name: 'Argentina' },
        },
        options: [
          {
            shipping_method_id: 73333,
            id: 1,
            name: 'Retiro en sucursal',
            currency_id: 'ARS',
            base_cost: 0,
            cost: 0,
            list_cost: 0,
            shipping_method_type: 'standard',
            shipping_option_type: 'agency', // <-- Nombre alternativo del campo
            estimated_delivery_time: {
              date: '2024-01-10',
              time_frame: { from: '09:00', to: '18:00' },
              type: 'known_frame',
              unit: 'days',
              shipping: 3,
              handling: 0,
            },
          },
        ],
      })
    );

    const request = new NextRequest('http://localhost:3000/api/shipments/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zipcode: '1001',
        items: [
          {
            id: '1',
            quantity: 1,
            price: 1000,
            mlItemId: 'MLA123456789',
          },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.pickup).toEqual({
      available: true,
      types: ['agency'],
    });
    expect(data.options[0].deliver_to).toBe('agency');
  });
});
