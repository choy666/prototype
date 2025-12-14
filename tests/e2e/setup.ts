import { test as base, expect } from '@playwright/test';

// Test base con configuración completa para E2E
export const test = base.extend({
  page: async ({ page, context }, use) => {
    // 1. Establecer cookies antes de navegar
    await context.addCookies([
      {
        name: 'playwright-test',
        value: 'true',
        domain: 'localhost',
        path: '/'
      },
      {
        name: 'next-auth.session-token',
        value: 'mock-session-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
      }
    ]);

    // 2. Mockear todas las rutas de auth relevantes
    await context.route('**/api/auth/session', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-id',
            name: 'Usuario Test',
            email: 'test@example.com',
            role: 'user'
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
      });
    });

    // 3. Mockear otras APIs necesarias
    await context.route('**/api/user/document', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documentType: 'DNI',
          documentNumber: '12345678'
        })
      });
    });

    // 4. Mockear endpoints de direcciones
    await context.route('**/api/addresses', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 1,
            nombre: 'Juan Pérez',
            direccion: 'Calle Test 123',
            ciudad: 'Buenos Aires',
            provincia: 'Buenos Aires',
            codigoPostal: '1001',
            telefono: '11987654321'
          }])
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            nombre: 'Juan Pérez',
            direccion: 'Calle Test 123',
            ciudad: 'Buenos Aires',
            provincia: 'Buenos Aires',
            codigoPostal: '1001',
            telefono: '11987654321'
          })
        });
      }
    });

    // 5. Mockear cálculo de envío
    await context.route('**/api/shipments/calculate', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          options: [{
            id: 'me2-standard',
            name: 'ME2 Standard',
            cost: 500,
            estimated: '3-5 días'
          }]
        })
      });
    });

    // 6. Mockear checkout
    await context.route('**/api/checkout', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          initPoint: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789'
        })
      });
    });

    await use(page);
  },
});

export { expect };
