// lib/middleware/admin-auth.ts

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

import { auth } from '@/lib/actions/auth';
import { logger } from '@/lib/utils/logger';

export interface AdminUser {
  id: string;
  email: string;
  role: 'admin';
}

export async function requireAdminAuth(req?: NextRequest): Promise<{ user: AdminUser } | never> {
  try {
    let user: AdminUser | null = null;

    // 1) Intentar validar header Authorization Bearer
    const token = req?.headers.get('authorization')?.replace('Bearer ', '');
    if (token) {
      user = await verifyAdminToken(token);
    }

    // 2) Fallback: usar sesión NextAuth si no se envió token explícito
    if (!user) {
      const session = await auth();
      if (session?.user?.role === 'admin') {
        user = {
          id: session.user.id,
          email: session.user.email ?? 'unknown',
          role: 'admin',
        };
      }
    }

    if (!user || user.role !== 'admin') {
      throw new Error('Acceso no autorizado - se requiere rol de admin');
    }

    logger.debug('[ADMIN] Autenticación exitosa', {
      userId: user.id,
      email: user.email,
      path: req?.nextUrl.pathname,
      strategy: token ? 'bearer' : 'session',
    });

    return { user };
  } catch (error) {
    logger.warn('[ADMIN] Intento de acceso no autorizado', {
      path: req?.nextUrl.pathname,
      userAgent: req?.headers.get('user-agent'),
      ip: req?.headers.get('x-forwarded-for') || 'unknown',
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

async function verifyAdminToken(token: string): Promise<AdminUser | null> {
  try {
    // Verificar que JWT_SECRET esté configurado
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET no configurado');
    }

    // Verificar y decodificar token JWT
    const decoded = jwt.verify(token, jwtSecret) as { user: AdminUser };

    // Validar estructura del payload
    if (!decoded.user || !decoded.user.id || !decoded.user.email || decoded.user.role !== 'admin') {
      throw new Error('Estructura de token inválida');
    }

    return {
      id: decoded.user.id,
      email: decoded.user.email,
      role: decoded.user.role,
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Token inválido o expirado');
    }
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export function createAdminErrorResponse(message: string, details?: string) {
  return NextResponse.json(
    {
      error: message,
      details,
      requiresAuth: true,
      timestamp: new Date().toISOString(),
    },
    { status: 401 }
  );
}

// Helper para generar tokens de admin (solo para desarrollo/testing)
export function generateAdminToken(user: AdminUser): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET no configurado');
  }

  return jwt.sign(
    {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    },
    jwtSecret,
    {
      expiresIn: '24h',
      issuer: 'prototype-admin',
      audience: 'prototype-api',
    }
  );
}
