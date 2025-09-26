// Forzar el uso de Node.js Runtime para esta ruta
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  
  // Obtener la URL base según el entorno
  let baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
  
  // Si estamos en desarrollo, forzar localhost
  if (process.env.NODE_ENV === 'development') {
    baseUrl = 'http://localhost:3000';
  } 
  // Si estamos en producción y no hay URL configurada, usar Vercel URL
  else if (!baseUrl && process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`;
  }

  // Asegurarse de que la URL base termine con /
  if (baseUrl && !baseUrl.endsWith('/')) {
    baseUrl = `${baseUrl}/`;
  }
  
  // Crear la URL de redirección
  const redirectUrl = new URL(callbackUrl, baseUrl || 'http://localhost:3000');
  
  // Redirigir a la URL de retorno
  return NextResponse.redirect(redirectUrl);
}