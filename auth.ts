import NextAuth from 'next-auth';
import type { NextAuthConfig, User as AuthUser, Session, DefaultSession } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { UserRole } from '@/types';

// Extender tipos de next-auth
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
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

export const authConfig = {
  adapter: DrizzleAdapter(db),
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' }
      },
      async authorize(credentials): Promise<AuthUser | null> {
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error('Credenciales incompletas');
          }

          const { email, password } = credentials as CredentialsType;

          const user = await db.query.users.findFirst({
            where: eq(users.email, email),
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

          const isValid = await bcrypt.compare(password, user.password);

          if (!isValid) {
            throw new Error('Contraseña incorrecta');
          }

          return {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role as UserRole,
          };
        } catch (error) {
          console.error('Error durante la autenticación:', error);
          throw new Error('Error en la autenticación');
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
        // Convertir el ID a número si es necesario
        token.id = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }): Promise<Session> {
      if (session.user) {
        // Asegurar que el ID sea string para la sesión
        session.user.id = token.id.toString();
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
      } catch {
        return baseUrl;
      }
      
      return baseUrl;
    }
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
} satisfies NextAuthConfig;

export const { 
  handlers: { GET, POST }, 
  auth, 
  signIn, 
  signOut 
} = NextAuth(authConfig);