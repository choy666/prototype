// lib/utils/cookies.ts
import { cookies } from 'next/headers';

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  maxAge?: number;
  expires?: Date;
};

// Versión asíncrona para Server Actions
export async function setCookieAsync(
  name: string, 
  value: string, 
  options: CookieOptions = {}
) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    ...options
  });
}
// Función para eliminar una cookie
export async function deleteCookie(name: string) {
    const cookieStore = await cookies();
    cookieStore.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0 // Expira inmediatamente
    });
}