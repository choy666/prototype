import { NextRequest, NextResponse } from 'next/server';
import { handlers } from '@/lib/actions/auth';

// Mock del endpoint de sesión para tests E2E
export async function GET(request: NextRequest) {
  // Verificar si es una petición de test E2E
  const userAgent = request.headers.get('user-agent') || '';
  const testCookie = request.cookies.get('playwright-test')?.value;
  
  if (userAgent.includes('playwright') || testCookie === 'true') {
    // Devolver sesión mock para tests
    return NextResponse.json({
      user: {
        id: 'test-user-id',
        name: 'Usuario Test',
        email: 'test@example.com',
        role: 'user'
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  // Para peticiones normales, dejar que NextAuth maneje
  return handlers.GET(request);
}
