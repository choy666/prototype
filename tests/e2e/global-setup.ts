import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Crear una sesión de autenticación válida
  await page.goto('http://localhost:3000/login');

  // Simular login directamente con cookies de NextAuth
  const sessionToken = 'test-session-token';
  const sessionData = {
    user: {
      id: 'test-user-id',
      name: 'Usuario Test',
      email: 'test@example.com',
      role: 'user'
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  // Establecer cookies de sesión para NextAuth
  await page.context().addCookies([
    {
      name: 'next-auth.session-token',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax'
    },
    {
      name: '__Secure-next-auth.session-token',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: true
    }
  ]);

  // Guardar estado de autenticación
  await context.storageState({ path: 'tests/e2e/storage-state.json' });

  await browser.close();
}

export default globalSetup;
