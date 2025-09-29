// lib/auth.ts
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("❌ Error crítico: La variable de entorno NEXTAUTH_SECRET no está definida.");
}
import NextAuth from "next-auth";
import type { NextAuthConfig, Session, DefaultSession, User } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { UserRole } from "@/types";


if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("❌ Error crítico: La variable de entorno NEXTAUTH_SECRET no está definida.");
}

// 🔧 Extender tipos de NextAuth
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
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

// 🔐 Validación de credenciales
async function validateCredentials(credentials: CredentialsType) {
  if (!credentials?.email || !credentials?.password) {
    throw new Error("Credenciales incompletas");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, credentials.email),
    columns: {
      id: true,
      name: true,
      email: true,
      password: true,
      role: true,
      emailVerified: true,
    },
  });

  if (!user) throw new Error("Usuario no encontrado");
  if (!user.password) throw new Error("Este usuario no tiene contraseña configurada");

  const isValid = await bcrypt.compare(credentials.password, user.password);
  if (!isValid) throw new Error("Contraseña incorrecta");

  return {
    id: user.id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
  };
}

// ⚙️ Configuración de NextAuth
export const authConfig = {
  adapter: DrizzleAdapter(db),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        console.log("\n[Authorize Callback] 🕵️‍♂️ Validando credenciales:", credentials);
        try {
          const user = await validateCredentials(credentials as CredentialsType);
          console.log("[Authorize Callback] ✅ Usuario validado:", user);
          return user;
        } catch (error) {
          console.error("[Authorize Callback] ❌ Error de validación:", error);
          // Retornar null para que NextAuth maneje el error
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      console.log("\n[JWT Callback] 🔄 Ejecutando...");
      console.log("[JWT Callback] 🕵️‍♂️ Token de entrada:", token);
      console.log("[JWT Callback] 🕵️‍♂️ Usuario de entrada (si es login):", user);

      if (trigger === "update" && session) {
        console.log("[JWT Callback] ✨ Trigger es 'update'. Actualizando token con:", session.user);
        return { ...token, ...session.user };
      }
      if (user) {
        console.log("[JWT Callback] ✨ Usuario existe (login). Inyectando datos al token.");
        token.id = user.id;
        token.role = (user as User).role;
      }
      console.log("[JWT Callback] ✅ Token de salida:", token);
      return token;
    },
    async session({ session, token }): Promise<Session> {
      console.log("\n[Session Callback] 🔄 Ejecutando...");
      console.log("[Session Callback] 🕵️‍♂️ Sesión de entrada:", session);
      console.log("[Session Callback] 🕵️‍♂️ Token de entrada:", token);

      if (session.user && token) {
        console.log("[Session Callback] ✨ Inyectando datos del token a la sesión.");
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      console.log("[Session Callback] ✅ Sesión de salida:", session);
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        if (url.startsWith("/login") || url.startsWith("/api/auth")) {
          return baseUrl;
        }
        return `${baseUrl}${url}`;
      } else if (new URL(url).origin === baseUrl) {
        return url;
      }
      return baseUrl;
    },
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" 
          ? `__Secure-next-auth.session-token`
          : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        domain:
          process.env.NODE_ENV === "production"
            ? process.env.NEXTAUTH_COOKIE_DOMAIN
            : undefined,
      },
    },
  },
} satisfies NextAuthConfig;

// 🚀 Inicializar NextAuth
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
