// lib/middleware/admin-auth.ts

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import jwt from 'jsonwebtoken';

export interface AdminUser {
  id: string;
  email: string;
  role: 'admin';
}

export async function requireAdminAuth(req: NextRequest): Promise<{ user: AdminUser } | never> {
  try {
    // Obtener token de autorización
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      throw new Error('Token de autorización requerido');
    }

    // Verificar token JWT real
    const user = await verifyAdminToken(token);
    
    if (!user || user.role !== 'admin') {
      throw new Error('Acceso no autorizado - se requiere rol de admin');
    }

    logger.debug('[ADMIN] Autenticación exitosa', {
      userId: user.id,
      email: user.email,
      path: req.nextUrl.pathname,
    });

    return { user };
    
  } catch (error) {
    logger.warn('[ADMIN] Intento de acceso no autorizado', {
      path: req.nextUrl.pathname,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || 'unknown',
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
      }
    },
    jwtSecret,
    { 
      expiresIn: '24h',
      issuer: 'prototype-admin',
      audience: 'prototype-api'
    }
  );
}
