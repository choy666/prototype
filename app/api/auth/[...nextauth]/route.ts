// app/api/auth/[...nextauth]/route.ts
import NextAuth, { DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import type { AdapterUser } from 'next-auth/adapters';
import type { NextAuthConfig } from 'next-auth';
import { UserRole } from '@/lib/schema';

// Extend session and user types
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

const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const { email, password } = credentials as { 
            email: string; 
            password: string 
          };

          const user = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.email, email)
          });

          if (!user?.password) {
            return null;
          }

          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            return null;
          }

          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name || '',
            role: user.role,
          } as AdapterUser;
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole | undefined) ?? 'user';
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET!,
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authConfig);

export { 
  handler as GET, 
  handler as POST,
  authConfig 
};