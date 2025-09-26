// Forzar el uso de Node.js Runtime para esta ruta
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  
  // Obtener la URL base según el entorno
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://prototype-ten-dun.vercel.app' 
    : 'http://localhost:3000';

  // Limpiar cualquier estado de autenticación existente
  const cookieStore = await cookies();
  cookieStore.delete('oauth_state');
  cookieStore.delete('ml_token');
  
  // Redirigir directamente al dashboard o a la URL de retorno
  return NextResponse.redirect(new URL(callbackUrl, baseUrl));
}