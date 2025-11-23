// lib/auth/session.ts
import { auth } from "@/lib/actions/auth"; // ✅ importar la función auth

export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

export async function getCurrentRole() {
  const session = await auth();
  return session?.user?.role;
}

export async function requireAuth() {
  const session = await auth();
  if (!session) {
    throw new Error("No autenticado");
  }
  return session;
}

// Exportar authOptions para compatibilidad con API routes
export { auth as authOptions };

export async function requireRole(role: string) {
  const session = await auth();
  if (!session || session.user?.role !== role) {
    throw new Error("No autorizado");
  }
  return session;
}

export async function isAdmin() {
  const role = await getCurrentRole();
  return role === 'admin';
}
