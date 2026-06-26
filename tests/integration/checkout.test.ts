// Mock de MercadoPago
jest.mock('mercadopago', () => ({
  __esModule: true,
  default: {
    preferences: {
      create: jest.fn()
    }
  },
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Preference: jest.fn().mockImplementation(() => ({
    create: jest.fn()
  })),
  Payment: {
    create: jest.fn()
  },
  preferences: {
    create: jest.fn()
  }
}));

// @ts-ignore - TypeScript no puede resolver este módulo debido a exclusiones en tsconfig.json
import { CheckoutService } from '@/lib/services/checkout';
// @ts-ignore - TypeScript no puede resolver este módulo debido a exclusiones en tsconfig.json
import { db } from '@/lib/db';
import mercadopago, { Preference } from 'mercadopago';
// @ts-ignore - TypeScript no puede resolver este módulo debido a exclusiones en tsconfig.json
import { validateProductsForME2Shipping } from '@/lib/validations/me2-products';
// @ts-ignore - Importar orders para el test
import { orders } from '@/lib/schema';

// Mock de la base de datos
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
        returning: jest.fn(() => Promise.resolve([{ id: 'order-123' }]))
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


// Mock de validaciones ME2
jest.mock('@/lib/validations/me2-products', () => ({
  validateProductsForME2Shipping: jest.fn()
}));

describe('CheckoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configurar mock por defecto para db.select - drizzle usa thenables que resuelven directamente
    const mockProducts = [{
      id: 1, // ID numérico como en la DB
      name: 'Producto Test',
      price: 10000,
      stock: 10,
      weight: 500,
      height: 10,
      width: 10,
      length: 10,
      shippingMode: 'me2',
      me2Compatible: true
    }];
    
    const mockWhere = jest.fn().mockResolvedValue(mockProducts);
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = db.select as jest.MockedFunction<typeof db.select>;
    mockSelect.mockReturnValue({ from: mockFrom } as any);
    
    // Configurar mocks por defecto para insert
    const mockInsert = db.insert as jest.MockedFunction<typeof db.insert>;
    mockInsert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 1 }])
      })
    } as any);
  });

  describe('processCheckout', () => {
    const mockRequest = {
      items: [
        {
          id: '1', // ID numérico como string para que coincida con la DB
          name: 'Producto Test',
          price: 10000,
          quantity: 2,
          image: '/test.jpg'
        }
      ],
      shippingAddress: {
        nombre: 'Juan Pérez',
        direccion: 'Calle Test 123',
        ciudad: 'Buenos Aires',
        provincia: 'Buenos Aires',
        codigoPostal: '1001',
        telefono: '11987654321'
      },
      shippingMethod: {
        id: 'me2-standard',
        name: 'ME2 Standard',
        cost: 500
      },
      userId: '1' // ID numérico como string
    };

    it('debe procesar un checkout exitoso', async () => {
      // Mock de validación ME2
      (validateProductsForME2Shipping as jest.Mock).mockReturnValue({
        allValid: true,
        validProducts: [mockRequest.items[0]],
        warnings: []
      });

      // Mock de inserción de orden
      (db.insert as any).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'order-123',
            userId: 'test-user-id',
            status: 'pending',
            total: 20500
          }])
        })
      });

      // Mock de preferencia de MercadoPago
      const mockPreference = {
        create: jest.fn().mockResolvedValueOnce({
          id: 'pref-123456789',
          init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789'
        })
      };
      
      // Mock del constructor Preference
      (Preference as jest.Mock).mockImplementation(() => mockPreference as any);

      const result = await CheckoutService.processCheckout(mockRequest);

      expect(result).toMatchObject({
        paymentUrl: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789',
        orderId: 'order-123',
        preferenceId: 'pref-123456789'
      });

      expect(mockPreference.create).toHaveBeenCalledWith({
        body: expect.objectContaining({
          external_reference: 'order-123'
        })
      });
    });

    it('debe rechazar si no hay stock suficiente', async () => {
      // Mock de producto con stock insuficiente
      const mockExecute = jest.fn().mockResolvedValue([{
        id: 1,
        name: 'Producto Test',
        price: 10000,
        stock: 1, // Solo 1 en stock
        weight: 500,
        height: 10,
        width: 10,
        length: 10
      }]);
      
      const mockSelect = db.select as jest.MockedFunction<typeof db.select>;
      mockSelect.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{
            id: 1,
            name: 'Producto Test',
            price: 10000,
            stock: 1, // Solo 1 en stock
            weight: 500,
            height: 10,
            width: 10,
            length: 10
          }])
        })
      } as any);

      await expect(CheckoutService.processCheckout(mockRequest))
        .rejects.toThrow('Stock insuficiente');
    });

    it('debe rechazar si los productos no son compatibles con ME2', async () => {
      // Mock de productos no compatibles
      const mockSelect = db.select as jest.MockedFunction<typeof db.select>;
      mockSelect.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{
            id: 1,
            name: 'Producto Test',
            price: 10000,
            stock: 10,
            weight: 500,
            height: 10,
            width: 10,
            length: 10,
            shippingMode: 'me2',
            me2Compatible: false
          }])
        })
      } as any);

      // Mock de validación ME2 que falla
      (validateProductsForME2Shipping as jest.Mock).mockReturnValue({
        allValid: false,
        validProducts: [],
        warnings: ['Producto no compatible con ME2']
      });

      await expect(CheckoutService.processCheckout(mockRequest))
        .rejects.toThrow('no son compatibles con Mercado Envíos 2');
    });

    it('debe manejar errores de MercadoPago y limpiar la orden', async () => {
      // Mock de productos
      const mockSelect = db.select as jest.MockedFunction<typeof db.select>;
      mockSelect.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{
            id: 1,
            name: 'Producto Test',
            price: 10000,
            stock: 10,
            weight: 500,
            height: 10,
            width: 10,
            length: 10,
            shippingMode: 'me2',
            me2Compatible: true
          }])
        })
      } as any);

      (validateProductsForME2Shipping as jest.Mock).mockReturnValue({
        allValid: true,
        validProducts: [mockRequest.items[0]],
        warnings: []
      });

      // Mock de inserción de orden
      const mockInsert = db.insert as jest.MockedFunction<typeof db.insert>;
      mockInsert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: 1 }])
        })
      } as any);

      // Mock de error en MercadoPago
      const mockPreference = {
        create: jest.fn().mockRejectedValueOnce(new Error('API Error'))
      };
      
      // Mock del constructor Preference
      (Preference as jest.Mock).mockImplementation(() => mockPreference as any);

      // Mock de delete para limpiar la orden
      const mockDelete = db.delete as jest.MockedFunction<typeof db.delete>;
      mockDelete.mockReturnValue({
        where: jest.fn().mockReturnValue({
          execute: jest.fn().mockResolvedValue(undefined)
        })
      } as any);

      await expect(CheckoutService.processCheckout(mockRequest))
        .rejects.toThrow('Error al procesar el pago con MercadoPago');

      // Verificar que se eliminó la orden
      expect(db.delete).toHaveBeenCalledWith(orders);
    });
  });

  describe('validateCart', () => {
    it('debe validar un carrito válido', () => {
      const items = [
        {
          id: 'product-1',
          name: 'Producto Test',
          price: 10000,
          quantity: 2
        }
      ];

      const result = CheckoutService.validateCart(items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('debe rechazar un carrito vacío', () => {
      const result = CheckoutService.validateCart([]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El carrito está vacío');
    });

    it('debe rechazar productos con datos incompletos', () => {
      const items = [
        {
          id: 'product-1',
          name: '',
          price: 10000,
          quantity: 2
        }
      ];

      const result = CheckoutService.validateCart(items);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('datos incompletos'))).toBe(true);
    });

    it('debe rechazar cantidades inválidas', () => {
      const items = [
        {
          id: 'product-1',
          name: 'Producto Test',
          price: 10000,
          quantity: 0
        }
      ];

      const result = CheckoutService.validateCart(items);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('mayor a 0'))).toBe(true);
    });

    it('debe rechazar precios inválidos', () => {
      const items = [
        {
          id: 'product-1',
          name: 'Producto Test',
          price: -100,
          quantity: 2
        }
      ];

      const result = CheckoutService.validateCart(items);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('mayor a 0'))).toBe(true);
    });
  });

  describe('calculateTotal', () => {
    it('debe calcular el total sin descuentos', () => {
      const items = [
        {
          id: 'product-1',
          name: 'Producto Test',
          price: 10000,
          quantity: 2
        }
      ];

      const total = CheckoutService.calculateTotal(items, 500);

      expect(total).toBe(20500); // (10000 * 2) + 500
    });

    it('debe calcular el total con descuentos', () => {
      const items = [
        {
          id: 'product-1',
          name: 'Producto Test',
          price: 10000,
          quantity: 2,
          discount: 10
        }
      ];

      const total = CheckoutService.calculateTotal(items, 500);

      expect(total).toBe(18500); // (10000 * 2 * 0.9) + 500
    });

    it('debe calcular el total con múltiples productos', () => {
      const items = [
        {
          id: 'product-1',
          name: 'Producto Test 1',
          price: 10000,
          quantity: 2
        },
        {
          id: 'product-2',
          name: 'Producto Test 2',
          price: 5000,
          quantity: 1
        }
      ];

      const total = CheckoutService.calculateTotal(items, 500);

      expect(total).toBe(25500); // (10000 * 2) + (5000 * 1) + 500
    });
  });
});
