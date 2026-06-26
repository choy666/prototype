import { test as base, expect } from '@playwright/test';

// Extender el test base con configuración de autenticación
export const test = base.extend({
  page: async ({ page }, use) => {
    // Establecer cookies de NextAuth ANTES de cualquier navegación
    await page.context().addCookies([
      {
        name: 'next-auth.session-token',
        value: 'test-session-token-mock',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
      },
      {
        name: 'playwright-test',
        value: 'true',
        domain: 'localhost',
        path: '/'
      }
    ]);

    // Mock de API de sesión con wildcard
    await page.route('**/api/auth/session', (route) => {
      console.log('Mock de /api/auth/session interceptado');
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

    // Mock de API de documento
    await page.route('/api/user/document', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            documentType: 'DNI',
            documentNumber: '12345678'
          })
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            documentType: 'DNI',
            documentNumber: '12345678'
          })
        });
      }
    });

    // Establecer cookies para bypass del middleware
    await page.context().addCookies([
      {
        name: 'playwright-test',
        value: 'true',
        domain: 'localhost',
        path: '/'
      }
    ]);

    await use(page);
  },
});

export { expect };
