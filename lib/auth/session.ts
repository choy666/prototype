import { getServerSession } from "@/lib/actions/auth";

export async function getCurrentUser() {
  const session = await getServerSession();
  return session?.user;
}

export async function getCurrentRole() {
  const session = await getServerSession();
  return session?.user?.role;
}

export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    throw new Error("No autenticado");
  }
  return session;
}

export async function requireRole(role: string) {
  const session = await getServerSession();
  if (!session || session.user?.role !== role) {
    throw new Error("No autorizado");
  }
  return session;
}