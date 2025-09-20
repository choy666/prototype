import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../schema";
import bcrypt from 'bcryptjs';
import { redirect } from "next/navigation";
import { sign, verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';

// Tipos para el estado del formulario
// In lib/actions/auth.ts
export type FormState = {
  error: string | null;
  success?: boolean;
  message?: string;
} | null;

// En lib/actions/auth.ts
export async function registerUser(prevState: FormState, formData: FormData): Promise<FormState> {
  const email = formData.get('email')?.toString();
  const name = formData.get('name')?.toString();
  const password = formData.get('password')?.toString();

  // Validación
  if (!email || !name || !password) {
    return { error: 'Todos los campos son obligatorios' };
  }

  try {
    // Verificar si el usuario ya existe
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return { error: 'El correo electrónico ya está en uso' };
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el usuario
    const [newUser] = await db.insert(users)
      .values({
        email,
        name,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Crear token JWT
    const token = sign(
      { userId: newUser.id.toString(), role: newUser.role || 'user' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    // Configurar cookie
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 hora
    });

    // Redirigir al dashboard
    redirect('/dashboard');
  } catch (error) {
    console.error('Error en el registro:', error);
    return { error: 'Error al crear la cuenta. Por favor, inténtalo de nuevo.' };
  }
}

// Función de login
export async function loginUser(prevState: FormState, formData: FormData): Promise<FormState> {
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return { error: 'Email y contraseña son requeridos' };
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.password) {
      return { error: 'Credenciales inválidas' };
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return { error: 'Credenciales inválidas' };
    }

    // Crear token JWT
    const token = sign(
      { userId: user.id.toString(), role: user.role || 'user' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    // Configurar cookie
      const cookieStore = await cookies();
      cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 hora
    });

    // Redirigir al dashboard
    redirect('/dashboard');
  } catch (error) {
    console.error('Error en el login:', error);
    return { error: 'Error al iniciar sesión. Por favor, inténtalo de nuevo.' };
  }
}

// Función para cerrar sesión
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  redirect('/auth/login');
}

// Función para verificar el token
export async function verifyToken(token: string) {
  try {
    const decoded = verify(token, process.env.JWT_SECRET!) as { userId: string; role: string };
    return { userId: decoded.userId, role: decoded.role };
  } catch (error) {
    return null;
  }
}

// Función para obtener el usuario actual
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;

  try {
    const decoded = verify(token, process.env.JWT_SECRET!) as { userId: string; role: string };
    const user = await db.query.users.findFirst({
      where: eq(users.id, parseInt(decoded.userId)),
    });
    return user;
  } catch (error) {
    return null;
  }
}