import { randomBytes } from 'crypto';

/**
 * Genera un token CSRF seguro
 * @returns Token CSRF como string hexadecimal
 */
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Valida un token CSRF
 * En producción, esto debería verificar contra un store seguro (Redis, DB, etc.)
 * Para esta implementación básica, solo verificamos que el token existe y tiene formato válido
 * @param token Token a validar
 * @returns true si es válido, false si no
 */
export function validateCSRFToken(token: string | null | undefined): boolean {
  if (!token) return false;

  // Verificar formato: debe ser hexadecimal de 64 caracteres (32 bytes)
  const hexRegex = /^[a-f0-9]{64}$/i;
  return hexRegex.test(token);
}

/**
 * Middleware para validar CSRF en requests POST
 * Debe ser usado en rutas que requieren protección CSRF
 */
export function validateCSRF(request: Request): boolean {
  const token = request.headers.get('x-csrf-token') ||
                new URL(request.url).searchParams.get('csrf_token');

  return validateCSRFToken(token);
}
