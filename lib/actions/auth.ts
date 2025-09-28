import NextAuth from 'next-auth';
import type { NextAuthConfig, Session, DefaultSession, User } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { UserRole } from '@/types';

// Extender tipos de next-auth
declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    name?: string | null;
    email: string;
    role: UserRole;
  }

  interface JWT {
    id: string;
    role: UserRole;
    [key: string]: unknown;
  }
}

interface CredentialsType {
  email: string;
  password: string;
}

// Validación de credenciales
async function validateCredentials(credentials: CredentialsType) {
  if (!credentials?.email || !credentials?.password) {
    throw new Error('Credenciales incompletas');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, credentials.email),
    columns: {
      id: true,
      name: true,
      email: true,
      password: true,
      role: true,
      emailVerified: true
    }
  });
  
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (!user.password) {
    throw new Error('Este usuario no tiene contraseña configurada');
  }

  const isValid = await bcrypt.compare(credentials.password, user.password);
  if (!isValid) {
    throw new Error('Contraseña incorrecta');
  }

  return {
    id: user.id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
  };
}

export const authConfig = {
  adapter: DrizzleAdapter(db),
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' }
      },
      async authorize(credentials): Promise<User | null> {
        try {
          return await validateCredentials(credentials as CredentialsType);
        } catch (error) {
          console.error('Error en autorización:', error);
          // No exponer detalles del error al cliente
          throw new Error(
            error instanceof Error ? error.message : 'Error en la autenticación'
          );
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
    updateAge: 24 * 60 * 60, // Actualiza la sesión cada 24 horas
  },
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === 'update' && session) {
        return { ...token, ...session.user };
      }
    
      if (user) {
        token.id = user.id;
        token.role = (user as User).role;
      }
      return token;
    },
    async session({ session, token }): Promise<Session> {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
    redirect({ url, baseUrl }) {
      if (!url) return baseUrl;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      
      try {
        const redirectUrl = new URL(url);
        if (redirectUrl.origin === baseUrl) return url;
        return baseUrl;
      } catch {
        return baseUrl;
      }
    }
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
} satisfies NextAuthConfig;

// Inicializar NextAuth
const auth = NextAuth(authConfig);

// Exportar handlers para la API route
export const handlers = auth.handlers;

// Exportar métodos de autenticación
export const { auth: getServerSession, signIn, signOut } = auth;