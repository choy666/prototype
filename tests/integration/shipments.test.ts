// Mock de la base de datos - debe ir antes de cualquier import que la use
jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          execute: jest.fn()
        }))
      }))
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([]))
      }))
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          execute: jest.fn()
        }))
      }))
    })),
    delete: jest.fn(() => ({
      where: jest.fn(() => ({
        execute: jest.fn()
      }))
    }))
  }
}));

// Mock de authOptions
jest.mock('@/lib/auth/session', () => ({
  authOptions: jest.fn(() => Promise.resolve({
    user: { email: 'test@example.com' }
  }))
}));

// Mock de getProductsByIds
jest.mock('@/lib/mercado-envios/me2Validator', () => ({
  getProductsByIds: jest.fn(() => Promise.resolve([
    {
      id: 1,
      name: 'Producto de prueba',
      weight: 500,
      height: 10,
      width: 10,
      length: 10,
      mlItemId: 'ML123456',
      shippingMode: 'me2',
      me2Compatible: true
    }
  ]))
}));

import { POST } from '@/app/api/shipments/calculate/route';
import { calculateME2ShippingCost } from '@/lib/actions/me2-shipping';
import { validateProductsForME2Shipping } from '@/lib/validations/me2-products';
import { NextRequest } from 'next/server';

// Mock del servicio ME2
jest.mock('@/lib/actions/me2-shipping', () => ({
  calculateME2ShippingCost: jest.fn()
}));

// Mock de validaciones
jest.mock('@/lib/validations/me2-products', () => ({
  validateProductsForME2Shipping: jest.fn()
}));

describe('/api/shipments/calculate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe calcular el envío correctamente con ME2', async () => {
    const mockME2Response = {
      shippingOptions: [
        {
          shipping_method_id: 73328,
          name: 'ME2 Standard',
          cost: 2390,
          list_cost: 2390,
          currency_id: 'ARS',
          estimated_delivery: {
            date: '2024-12-20',
            time_from: '09:00',
            time_to: '18:00'
          },
          shipping_mode: 'me2',
          logistic_type: 'drop_off'
        },
        {
          shipping_method_id: 73329,
          name: 'ME2 Prioritario',
          cost: 3120,
          list_cost: 3120,
          currency_id: 'ARS',
          estimated_delivery: {
            date: '2024-12-18',
            time_from: '09:00',
            time_to: '18:00'
          },
          shipping_mode: 'me2',
          logistic_type: 'drop_off'
        }
      ],
      source: 'me2',
      fallback: false,
      coverage: {
        zip_code: '1001',
        coverage_type: 'full'
      },
      destination: {
        zip_code: '1001',
        city: { id: 'TUxBQ0JPTGjjNjYw', name: 'Ciudad Autónoma de Buenos Aires' },
        state: { id: 'AR-C', name: 'Capital Federal' },
        country: { id: 'AR', name: 'Argentina' }
      },
      estimatedDelivery: 3,
      totalCost: 2390,
      currency: 'ARS'
    };

    (validateProductsForME2Shipping as jest.Mock).mockReturnValue({
      isValid: true,
      validProducts: [
        {
          id: 'product-1',
          weight: 500,
          height: 10,
          width: 10,
          length: 10
        }
      ],
      warnings: []
    });

    (calculateME2ShippingCost as jest.Mock).mockResolvedValue(mockME2Response);

    // Crear un NextRequest mock
    const request = new NextRequest('http://localhost:3000/api/shipments/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zipcode: '1001',
        items: [
          {
            id: '1', // Usar ID numérico como string
            quantity: 2,
            weight: 500,
            dimensions: {
              height: 10,
              width: 10,
              length: 10
            },
            price: 10000
          }
        ]
      })
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    
    expect(responseData).toHaveProperty('options');
    expect(responseData.options).toHaveLength(2);
    expect(responseData.options[0]).toMatchObject({
      name: 'ME2 Standard',
      cost: 2390,
      estimated: '2024-12-20'
    });

    expect(calculateME2ShippingCost).toHaveBeenCalledWith({
      zipcode: '1001',
      items: expect.arrayContaining([
        expect.objectContaining({ 
          id: '1', // ID como string
          quantity: 2,
          weight: 500,
          height: 10,
          width: 10,
          length: 10,
          price: 10000,
          name: 'Producto de prueba',
          me2Compatible: true,
          mlItemId: 'ML123456',
          shippingMode: 'me2'
        })
      ]),
      dimensions: expect.objectContaining({
        height: 10,
        width: 10,
        length: 10,
        weight: 500
      })
    });
  });

  it('debe usar fallback local cuando ME2 falla', async () => {
    (validateProductsForME2Shipping as jest.Mock).mockReturnValue({
      isValid: true,
      validProducts: [
        {
          id: 'product-1',
          weight: 500,
          height: 10,
          width: 10,
          length: 10
        }
      ],
      warnings: []
    });

    // Mock de error en ME2
    (calculateME2ShippingCost as jest.Mock).mockRejectedValue(
      new Error('Servicio no disponible')
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
            quantity: 2,
            weight: 500,
            dimensions: {
              height: 10,
              width: 10,
              length: 10
            },
            price: 10000
          }
        ]
      })
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    
    expect(responseData.error).toContain('Error al calcular costo de envío');
  });

  it('debe validar los datos de entrada', async () => {
    const request = new NextRequest('http://localhost:3000/api/shipments/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zipcode: '', // Vacío
        items: [] // Vacío
      })
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toContain('Datos inválidos');
    expect(responseData.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'zipcode',
          message: 'Código postal requerido'
        })
      ])
    );
  });

  it('debe validar dimensiones mínimas de los productos', async () => {
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
            weight: 0, // Peso inválido
            dimensions: {
              height: 0, // Altura inválida
              width: 0,  // Ancho inválido
              length: 0, // Largo inválido
            },
            price: 10000
          }
        ]
      })
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toContain('Datos inválidos');
    expect(responseData.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'items.0.dimensions.height',
          message: 'Altura requerida en cm'
        })
      ])
    );
  });

  it('debe manejar códigos postales no cubiertos por ME2', async () => {
    (validateProductsForME2Shipping as jest.Mock).mockReturnValue({
      isValid: true,
      validProducts: [
        {
          id: 'product-1',
          weight: 500,
          height: 10,
          width: 10,
          length: 10
        }
      ],
      warnings: []
    });

    // Mock de error específico de ME2
    const me2Error = new Error('Código postal no cubierto');
    me2Error.name = 'ZipCodeNotCoveredError';
    (calculateME2ShippingCost as jest.Mock).mockRejectedValue(me2Error);

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
            weight: 500,
            dimensions: {
              height: 10,
              width: 10,
              length: 10
            },
            price: 10000
          }
        ]
      })
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toContain('Error al calcular costo de envío');
  });

  it('debe calcular envío gratis para pedidos grandes', async () => {
    const mockME2Response = {
      shippingOptions: [
        {
          shipping_method_id: 73328,
          name: 'ME2 Standard',
          cost: 0, // Envío gratis
          list_cost: 0,
          currency_id: 'ARS',
          estimated_delivery: {
            date: '2024-12-20',
            time_from: '09:00',
            time_to: '18:00'
          },
          shipping_mode: 'me2',
          logistic_type: 'drop_off'
        }
      ],
      source: 'me2',
      fallback: false,
      estimatedDelivery: 3,
      totalCost: 0,
      currency: 'ARS'
    };

    (validateProductsForME2Shipping as jest.Mock).mockReturnValue({
      isValid: true,
      validProducts: [
        {
          id: 'product-1',
          weight: 500,
          height: 10,
          width: 10,
          length: 10
        }
      ],
      warnings: []
    });

    (calculateME2ShippingCost as jest.Mock).mockResolvedValue(mockME2Response);

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
            weight: 500,
            dimensions: {
              height: 10,
              width: 10,
              length: 10
            },
            price: 50000 // Pedido grande
          }
        ]
      })
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    
    expect(responseData.options[0]).toMatchObject({
      name: 'ME2 Standard',
      cost: 0
    });
  });

  it('debe manejar múltiples productos correctamente', async () => {
    const mockME2Response = {
      shippingOptions: [
        {
          shipping_method_id: 73328,
          name: 'ME2 Standard',
          cost: 2390,
          list_cost: 2390,
          currency_id: 'ARS',
          estimated_delivery: {
            date: '2024-12-20',
            time_from: '09:00',
            time_to: '18:00'
          },
          shipping_mode: 'me2',
          logistic_type: 'drop_off'
        }
      ],
      source: 'me2',
      fallback: false,
      estimatedDelivery: 3,
      totalCost: 2390,
      currency: 'ARS'
    };

    (validateProductsForME2Shipping as jest.Mock).mockReturnValue({
      isValid: true,
      validProducts: [
        {
          id: 'product-1',
          weight: 500,
          height: 10,
          width: 10,
          length: 10
        },
        {
          id: 'product-2',
          weight: 300,
          height: 5,
          width: 5,
          length: 5
        }
      ],
      warnings: []
    });

    (calculateME2ShippingCost as jest.Mock).mockResolvedValue(mockME2Response);

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
            quantity: 2,
            weight: 500,
            dimensions: {
              height: 10,
              width: 10,
              length: 10
            },
            price: 10000
          },
          {
            id: '2',
            quantity: 1,
            weight: 300,
            dimensions: {
              height: 5,
              width: 5,
              length: 5
            },
            price: 5000
          }
        ]
      })
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(calculateME2ShippingCost).toHaveBeenCalledWith({
      zipcode: '1001',
      items: expect.arrayContaining([
        expect.objectContaining({ 
          id: '1',
          quantity: 2,
          weight: 500,
          height: 10,
          width: 10,
          length: 10,
          price: 10000,
          name: 'Producto de prueba',
          me2Compatible: true,
          mlItemId: 'ML123456',
          shippingMode: 'me2'
        }),
        expect.objectContaining({ 
          id: '2',
          quantity: 1,
          weight: 300,
          height: 5,
          width: 5,
          length: 5,
          price: 5000,
          name: 'Producto desconocido',
          me2Compatible: undefined,
          mlItemId: undefined,
          shippingMode: undefined
        })
      ]),
      dimensions: expect.objectContaining({
        height: 10,
        width: 10,
        length: 10,
        weight: 500
      })
    });
  });

  it('debe incluir warnings de validación en la respuesta', async () => {
    (validateProductsForME2Shipping as jest.Mock).mockReturnValue({
      isValid: true,
      validProducts: [
        {
          id: 'product-1',
          weight: 500,
          height: 10,
          width: 10,
          length: 10
        }
      ],
      warnings: ['El producto X no tiene todos los atributos ME2']
    });

    const mockME2Response = {
      shippingOptions: [
        {
          shipping_method_id: 73328,
          name: 'ME2 Standard',
          cost: 2390,
          list_cost: 2390,
          currency_id: 'ARS',
          estimated_delivery: {
            date: '2024-12-20',
            time_from: '09:00',
            time_to: '18:00'
          },
          shipping_mode: 'me2',
          logistic_type: 'drop_off'
        }
      ],
      source: 'me2',
      fallback: false,
      estimatedDelivery: 3,
      totalCost: 2390,
      currency: 'ARS',
      warnings: ['El producto X no tiene todos los atributos ME2']
    };

    (calculateME2ShippingCost as jest.Mock).mockResolvedValue(mockME2Response);

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
            weight: 500,
            dimensions: {
              height: 10,
              width: 10,
              length: 10
            },
            price: 10000
          }
        ]
      })
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    
    expect(responseData).toHaveProperty('warnings');
    expect(responseData.warnings).toContain('El producto X no tiene todos los atributos ME2');
  });
});
