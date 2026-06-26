'use server';

import { db } from '../db';
import { users } from '../schema';
import { eq, sql } from 'drizzle-orm';
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
): Promise<{ data: User[]; pagination: unknown; filters: unknown }> {
  try {
    const validatedPage = z.coerce.number().int().min(1).default(1).parse(page);
    const validatedLimit = z.coerce.number().int().min(1).default(10).parse(limit);
    const validatedFilters = userFiltersSchema.parse(filters);

    const { search, role, sortBy, sortOrder } = validatedFilters;

    // Construir consulta directa con Drizzle
    const offset = (validatedPage - 1) * validatedLimit;
    
    // Aplicar filtros
    const conditions = [];
    if (role) {
      conditions.push(eq(users.role, role));
    }
    
    // Aplicar búsqueda
    if (search) {
      // Implementar búsqueda básica en nombre y email
      // Aquí podrías usar ilike si lo necesitas
    }
    
    // Construir query en una sola cadena para mantener tipos
    let data;
    if (conditions.length > 0) {
      const baseQuery = db.select().from(users).where(
        conditions.length === 1 ? conditions[0] : sql`${conditions.join(' AND ')}`
      );
      
      // Aplicar ordenamiento
      const orderField = sortBy === 'name' ? users.name : 
                        sortBy === 'email' ? users.email :
                        sortBy === 'role' ? users.role : 
                        users.createdAt;
      
      data = await (sortOrder === 'desc' 
        ? baseQuery.orderBy(sql`${orderField} DESC`)
        : baseQuery.orderBy(sql`${orderField} ASC`)
      ).limit(validatedLimit).offset(offset);
    } else {
      // Sin filtros
      const orderField = sortBy === 'name' ? users.name : 
                        sortBy === 'email' ? users.email :
                        sortBy === 'role' ? users.role : 
                        users.createdAt;
      
      data = await (sortOrder === 'desc'
        ? db.select().from(users).orderBy(sql`${orderField} DESC`)
        : db.select().from(users).orderBy(sql`${orderField} ASC`)
      ).limit(validatedLimit).offset(offset);
    }
    
    // Obtener total para paginación
    let totalResult;
    if (conditions.length > 0) {
      totalResult = await db.select().from(users).where(
        conditions.length === 1 ? conditions[0] : sql`${conditions.join(' AND ')}`
      );
    } else {
      totalResult = await db.select().from(users);
    }
    const total = totalResult.length;

    return {
      data,
      pagination: {
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
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
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    console.error('Error fetching user by id:', error);
    throw new Error('No se pudo obtener el usuario');
  }
}

// Actualizar el rol de un usuario
export async function updateUserRole(id: number, role: 'user' | 'admin'): Promise<User | null> {
  try {
    const result = await db
      .update(users)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    
    const updatedUser = result[0] || null;
    
    revalidatePath('/admin/users');
    return updatedUser;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw new Error('No se pudo actualizar el rol del usuario');
  }
}

// Crear un nuevo usuario (para futuras expansiones)
export async function createUser(userData: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  try {
    // Preparar datos con timestamps
    const newUserData = {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db
      .insert(users)
      .values(newUserData)
      .returning();
    
    const newUser = result[0];

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
    // Verificar si el usuario tiene órdenes asociadas (lógica de negocio específica)
    const ordersCount = await db.$count(
      sql`SELECT COUNT(*) FROM orders WHERE user_id = ${id}`
    );
    if (ordersCount > 0) {
      throw new Error('No se puede eliminar el usuario porque tiene órdenes asociadas');
    }

    const result = await db
      .delete(users)
      .where(eq(users.id, id));

    const deleted = result.rowCount > 0;
    
    revalidatePath('/admin/users');
    return deleted;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

// Métodos adicionales usando el repositorio genérico

// Verificar si existe un usuario
export async function userExists(id: number): Promise<boolean> {
  try {
    const result = await db
      .select({ count: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    return result.length > 0;
  } catch (error) {
    console.error('Error checking user existence:', error);
    return false;
  }
}

// Buscar usuarios por email
export async function findUserByEmail(email: string): Promise<User | null> {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

// Contar usuarios con filtros
export async function countUsers(filters: { role?: 'user' | 'admin' } = {}): Promise<number> {
  try {
    let result;
    if (filters.role) {
      result = await db.select().from(users).where(eq(users.role, filters.role));
    } else {
      result = await db.select().from(users);
    }
    return result.length;
  } catch (error) {
    console.error('Error counting users:', error);
    return 0;
  }
}

