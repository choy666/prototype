'use server';

import { db } from '../db';
import { users } from '../schema';
import { and, eq, desc, sql, asc } from 'drizzle-orm';
import type { User, NewUser } from '../schema';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Esquema de validación para filtros de usuarios
const userFiltersSchema = z.object({
  search: z.string().optional(),
  role: z.enum(['user', 'admin']).optional(),
  sortBy: z.enum(['name', 'email', 'role', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Obtener usuarios con paginación y filtros
export async function getUsers(
  page = 1,
  limit = 10,
  filters: { search?: string; role?: 'user' | 'admin'; sortBy?: string; sortOrder?: string } = {}
) {
  try {
    const validatedPage = z.coerce.number().int().min(1).default(1).parse(page);
    const validatedLimit = z.coerce.number().int().min(1).default(10).parse(limit);
    const validatedFilters = userFiltersSchema.parse(filters);

    const offset = (validatedPage - 1) * validatedLimit;
    const { search, role, sortBy, sortOrder } = validatedFilters;

    // Construir condiciones de filtro
    const conditions = [];
    if (role) {
      conditions.push(eq(users.role, role));
    }
    if (search) {
      conditions.push(
        sql`(${users.name} ILIKE ${`%${search}%`} OR ${users.email} ILIKE ${`%${search}%`})`
      );
    }

    // Obtener datos y conteo total en paralelo
    const [data, countResult] = await Promise.all([
      db.query.users.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: (sortOrder === 'desc' ? desc : asc)(users[sortBy]),
        limit: validatedLimit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const count = Number(countResult[0]?.count ?? 0);

    return {
      data,
      pagination: {
        total: count,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(count / validatedLimit),
      },
      filters: validatedFilters,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues);
      throw new Error('Parámetros de filtros inválidos');
    }
    console.error('Error fetching users:', error);
    return {
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
      filters: {},
    };
  }
}

// Obtener un usuario por ID
export async function getUserById(id: number): Promise<User | null> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  } catch (error) {
    console.error('Error fetching user by id:', error);
    throw new Error('No se pudo obtener el usuario');
  }
}

// Actualizar el rol de un usuario
export async function updateUserRole(id: number, role: 'user' | 'admin'): Promise<User | null> {
  try {
    const [updatedUser] = await db
      .update(users)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    revalidatePath('/admin/users');
    return updatedUser || null;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw new Error('No se pudo actualizar el rol del usuario');
  }
}

// Crear un nuevo usuario (para futuras expansiones)
export async function createUser(userData: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  try {
    const [newUser] = await db
      .insert(users)
      .values({
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    revalidatePath('/admin/users');
    return newUser;
  } catch (error) {
    console.error('Error creating user:', error);
    throw new Error('No se pudo crear el usuario');
  }
}

// Eliminar un usuario (con precauciones)
export async function deleteUser(id: number): Promise<boolean> {
  try {
    // Verificar si el usuario tiene órdenes asociadas
    const ordersCount = await db.$count(
      sql`SELECT COUNT(*) FROM orders WHERE user_id = ${id}`
    );
    if (ordersCount > 0) {
      throw new Error('No se puede eliminar el usuario porque tiene órdenes asociadas');
    }

    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });

    revalidatePath('/admin/users');
    return !!deletedUser;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}
