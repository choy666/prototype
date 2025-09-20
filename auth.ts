// auth.ts
import NextAuth, { type DefaultSession } from 'next-auth';
import { authConfig } from './app/api/auth/[...nextauth]/route';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from './lib/db';
import { eq } from 'drizzle-orm';
import { users, type UserRole } from './lib/schema';
import type { JWT } from 'next-auth/jwt';
import type { AdapterSession } from 'next-auth/adapters';
// Extender tipos de NextAuth para TypeScript
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role?: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role?: string;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role?: string;
  }
}

export const { 
  auth,
  handlers: { GET, POST },
  signIn,
  signOut
} = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as UserRole | undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole | undefined) ?? 'user';
      }
      return session;
    }
  },
  events: {
    async signIn({ user }) {
      console.log('Usuario autenticado:', user.email);
      try {
        await db.update(users)
          .set({ updatedAt: new Date() })
          .where(eq(users.id, parseInt(user.id)));
      } catch (error) {
        console.error('Error al actualizar lastLogin:', error);
      }
    },
    async signOut(message: { session?: void | AdapterSession | null } | { token: JWT | null }) {
      if ('token' in message && message.token?.email) {
        console.log('Usuario cerró sesión:', message.token.email);
      } else if ('session' in message && message.session) {
        console.log('Sesión finalizada (database session)');
      }
      return Promise.resolve();
    }
  },
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(error: Error) {
      console.error('Error de autenticación:', error);
    },
    warn(code: string) {
      console.warn('Advertencia de autenticación:', code);
    },
    debug(code: string, metadata?: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Debug de autenticación:', { code, metadata });
      }
    }
  }
});