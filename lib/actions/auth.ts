// lib/actions/auth.ts
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import bcrypt from 'bcryptjs';
import { registerSchema } from '@/lib/validations/auth';
import { z } from 'zod';
import { auth } from '../../auth';

// Tipos
export interface AuthResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

// Función para registro de usuarios
export async function registerUser(
  formData: z.infer<typeof registerSchema>
) {
  try {
    // Validar datos de entrada
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword: _, ...userData } = registerSchema.parse(formData);

    // Verificar si el usuario ya existe
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, userData.email),
    });

    if (existingUser) {
      return {
        success: false,
        error: 'Ya existe un usuario con este correo electrónico',
      };
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    // Crear el usuario en la base de datos
    const [newUser] = await db
      .insert(users)
      .values({
        ...userData,
        password: hashedPassword,
        role: 'user',
        emailVerified: new Date(),
      })
      .returning();

    // No devolver la contraseña
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = newUser;

    return {
      success: true,
      data: userWithoutPassword,
    };
  } catch (error) {
    console.error('Error en registerUser:', error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Datos de entrada inválidos',
      };
    }

    return {
      success: false,
      error: 'Error al crear la cuenta. Por favor, inténtalo de nuevo.',
    };
  }
}

// Función para obtener el usuario actual
export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

// Función para requerir autenticación
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('No autenticado');
  }
  return session.user;
}