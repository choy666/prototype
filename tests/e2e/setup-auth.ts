import { test as base } from '@playwright/test';

// Extender el test para configurar autenticación antes de cada test
export const test = base.extend({
  page: async ({ page }, use) => {
    // Interceptar el middleware para mockear autenticación
    await page.route('**/middleware', (route) => {
      // Permitir acceso sin autenticación en modo test
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/plain' },
        body: 'Middleware bypassed for test'
      });
    });

    // Mock de la API de sesión
    await page.route('/api/auth/session', (route) => {
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

    // Establecer cookies de sesión directamente
    await page.context().addCookies([
      {
        name: 'next-auth.session-token',
        value: 'test-session-token-mock',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
      }
    ]);

    await use(page);
  },
});

export { expect } from '@playwright/test';
