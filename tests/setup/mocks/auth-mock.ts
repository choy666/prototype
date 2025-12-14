import { NextRequest } from 'next/server';

// Mock del sistema de autenticación para tests
export const mockAuth = (role: 'user' | 'admin' = 'user') => {
  const sessionData = {
    user: {
      id: role === 'admin' ? 'admin-user-id' : 'test-user-id',
      name: role === 'admin' ? 'Admin User' : 'Usuario Test',
      email: role === 'admin' ? 'admin@example.com' : 'test@example.com',
      role
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  return sessionData;
};

// Mock para el endpoint de sesión
export const mockSessionEndpoint = (role: 'user' | 'admin' = 'user') => {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockAuth(role))
  };
};
