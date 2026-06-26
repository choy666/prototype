import { test, expect } from './setup';

test.describe('Flujo de Checkout', () => {
  test.beforeEach(async ({ page }) => {
    // Los mocks ya están configurados en helpers.ts
  });

  test('debe mostrar error si el carrito está vacío', async ({ page }) => {
    await page.goto('/checkout');
    
    await expect(page.locator('h1')).toContainText('Tu carrito está vacío');
    await expect(page.locator('text=Ver Productos')).toBeVisible();
  });

  test('flujo completo de checkout con dirección existente', async ({ page }) => {
    // Mock del carrito con productos
    await page.addInitScript(() => {
      window.localStorage.setItem('cart-storage', JSON.stringify({
        state: {
          items: [{
            id: 'test-product-1',
            name: 'Producto Test',
            price: 10000,
            quantity: 1,
            image: '/test-image.jpg',
            weight: 500,
            height: 10,
            width: 10,
            length: 10
          }],
          totalItems: 1,
          totalAmount: 10000
        },
        version: 0
      }));
    });

    // Mock de direcciones
    await page.route('/api/addresses', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 1,
          nombre: 'Juan Pérez',
          direccion: 'Calle Test',
          numero: '123',
          ciudad: 'Buenos Aires',
          provincia: 'Buenos Aires',
          codigoPostal: '1001',
          telefono: '1123456789'
        }])
      });
    });

    // Mock de validación de DNI
    await page.route('/api/user/document', (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        if (body.documentNumber === '123') {
          route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Error de validación',
              details: [{
                field: 'documentNumber',
                message: 'El DNI debe tener entre 7 y 8 dígitos'
              }]
            })
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              documentType: body.documentType,
              documentNumber: body.documentNumber
            })
          });
        }
      }
    });

    // Mock de cálculo de envío (POST)
    await page.route('/api/shipments/calculate', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            methods: [{
              shipping_method_id: 'me2-standard',
              name: 'ME2 Standard',
              cost: 500,
              estimated_delivery: { date: '2024-12-20' },
              description: 'Envío estándar a domicilio',
              shipping_mode: 'me2'
            }],
            source: 'me2',
            fallback: false
          })
        });
      }
    });

    // Mock de checkout
    await page.route('/api/checkout', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          initPoint: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789'
        })
      });
    });

    await page.goto('/checkout');

    // Paso 1: Selección de dirección
    await expect(page.locator('h1')).toContainText('Checkout');
    // Seleccionar la primera dirección existente (Juan Pérez)
    await page.locator('text=Juan Pérez').first().click();
    
    // Esperar a que se cargue el formulario con los datos de la dirección
    await expect(page.locator('#nombre')).toHaveValue('Juan Pérez');
    await expect(page.locator('#direccion')).toHaveValue('Calle Test');
    await expect(page.locator('#numero')).toHaveValue('123');

    // Paso 2: Formulario de envío (debería estar prellenado)
    await expect(page.locator('text=Continuar al Pago')).toBeVisible();
    
    // Verificar que el formulario está completo antes de enviar
    await expect(page.locator('#nombre')).toHaveValue('Juan Pérez');
    await expect(page.locator('#direccion')).toHaveValue('Calle Test');
    await expect(page.locator('#numero')).toHaveValue('123');
    await expect(page.locator('#ciudad')).toHaveValue('Buenos Aires');
    await expect(page.locator('#provincia')).toHaveValue('Buenos Aires');
    await expect(page.locator('#codigoPostal')).toHaveValue('1001');
    await expect(page.locator('#telefono')).toHaveValue('1123456789');
    
    // Enviar formulario
    await page.locator('button[type="submit"]').click();
    
    // Esperar a que aparezca la selección de método de envío
    await expect(page.locator('text=Método de Envío')).toBeVisible({ timeout: 5000 });

    // Paso 3: Selección de método de envío
    await expect(page.locator('text=ME2 Standard')).toBeVisible({ timeout: 5000 });
    await page.locator('text=ME2 Standard').click();
    await page.locator('text=Continuar al Pago').click();

    // Verificar redirección a MercadoPago
    await expect(page).toHaveURL(/mercadopago\.com/);
  });

  test('debe validar el documento DNI correctamente', async ({ page }) => {
    // Mock del carrito
    await page.addInitScript(() => {
      window.localStorage.setItem('cart-storage', JSON.stringify({
        state: {
          items: [{
            id: 'test-product-1',
            name: 'Producto Test',
            price: 10000,
            quantity: 1,
            image: '/test-image.jpg'
          }],
          totalItems: 1,
          totalAmount: 10000
        },
        version: 0
      }));
    });

    // Mock de validación de DNI
    await page.route('/api/user/document', (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        if (body.documentNumber === '123') {
          route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Error de validación',
              details: [{
                field: 'documentNumber',
                message: 'El DNI debe tener entre 7 y 8 dígitos'
              }]
            })
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              documentType: body.documentType,
              documentNumber: body.documentNumber
            })
          });
        }
      }
    });

    // Mock de cálculo de envío (POST)
    await page.route('/api/shipments/calculate', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            methods: [{
              shipping_method_id: 'me2-standard',
              name: 'ME2 Standard',
              cost: 500,
              estimated_delivery: { date: '2024-12-20' },
              description: 'Envío estándar a domicilio',
              shipping_mode: 'me2'
            }],
            source: 'me2',
            fallback: false
          })
        });
      }
    });

    await page.goto('/checkout');
    await page.locator('text=Usar una dirección diferente').click();

    // Llenar formulario de dirección
    await page.fill('[placeholder="Juan Pérez"]', 'Juan Pérez');
    await page.fill('[placeholder="Av. Corrientes"]', 'Calle Test');
    await page.fill('[placeholder="1234"]', '123');
    await page.fill('[placeholder="5"]', '');
    await page.fill('[placeholder="B"]', '');
    await page.fill('#ciudad', 'Buenos Aires');
    await page.fill('#provincia', 'Buenos Aires');
    await page.fill('[placeholder="1234 o C1234ABC"]', '1001');
    await page.fill('[placeholder="1123456789"]', '1123456789');

    // Intentar continuar con DNI inválido
    await page.selectOption('select#documentType', 'DNI');
    await page.fill('input#documentNumber', '123');
    await page.locator('button[type=submit]').click();

    // Esperar a que se muestre el error de validación
    await expect(page.locator('text=El DNI debe tener entre 7 y 8 dígitos')).toBeVisible({ timeout: 5000 });

    // Corregir DNI
    await page.fill('input#documentNumber', '12345678');
    await page.locator('button[type=submit]').click();

    // Debería avanzar al siguiente paso
    await expect(page.locator('text=Método de Envío')).toBeVisible();
  });

  test('debe manejar fallback cuando ME2 falla', async ({ page }) => {
    // Mock del carrito
    await page.addInitScript(() => {
      window.localStorage.setItem('cart-storage', JSON.stringify({
        state: {
          items: [{
            id: 'test-product-1',
            name: 'Producto Test',
            price: 10000,
            quantity: 1,
            image: '/test-image.jpg'
          }],
          totalItems: 1,
          totalAmount: 10000
        },
        version: 0
      }));
    });

    // Mock de direcciones
    await page.route('/api/addresses', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 1,
          nombre: 'Juan Pérez',
          direccion: 'Calle Test',
          numero: '123',
          ciudad: 'Buenos Aires',
          provincia: 'Buenos Aires',
          codigoPostal: '1001',
          telefono: '1123456789'
        }])
      });
    });

    // Mock de validación de DNI
    await page.route('/api/user/document', (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            documentType: 'DNI',
            documentNumber: '12345678'
          })
        });
      }
    });

    // Mock de envío fallback (POST)
    await page.route('/api/shipments/calculate', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            methods: [{
              shipping_method_id: 'standard',
              name: 'Envío Estándar',
              cost: 800,
              description: 'Envío local estándar',
              shipping_mode: 'standard',
              type: 'internal'
            }, {
              shipping_method_id: 'express',
              name: 'Opción de envío local',
              cost: 1200,
              description: 'Envío local express',
              shipping_mode: 'express',
              type: 'internal'
            }],
            source: 'internal_shipping',
            fallback: true,
            message: 'Usando métodos de envío locales'
          })
        });
      }
    });

    await page.goto('/checkout');
    await page.locator('text=Usar una dirección diferente').click();
    
    // Llenar formulario mínimo para poder continuar
    await page.fill('[placeholder="Juan Pérez"]', 'Juan Test');
    await page.fill('[placeholder="Av. Corrientes"]', 'Calle Test');
    await page.fill('[placeholder="1234"]', '123');
    await page.fill('#ciudad', 'Buenos Aires');
    await page.fill('#provincia', 'Buenos Aires');
    await page.fill('[placeholder="1234 o C1234ABC"]', '1001');
    await page.fill('[placeholder="1123456789"]', '1123456789');
    
    await page.locator('button[type=submit]').click();

    // Esperar a que se carguen las opciones de envío
    await expect(page.locator('text=Envío Estándar')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Opción de envío local')).toBeVisible();
  });

  test('debe bloquear el checkout para usuarios admin', async ({ page }) => {
    // Mock de admin - sobreescribe el mock global
    await page.route('**/api/auth/session', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'admin-user-id',
            name: 'Admin User',
            email: 'admin@example.com',
            role: 'admin'
          },
          expires: '2024-12-31T23:59:59.999Z'
        })
      });
    });

    await page.goto('/checkout');

    await expect(page.locator('h1')).toContainText('Acceso denegado');
    await expect(page.locator('text=Los administradores no pueden realizar compras')).toBeVisible();
  });
});
