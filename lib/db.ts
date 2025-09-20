import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Crear la conexión a la base de datos
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

// Función para verificar la conexión
export async function checkDbConnection() {
  if (!process.env.DATABASE_URL) {
    return {
      success: false,
      message: 'No DATABASE_URL environment variable',
    };
  }

  try {
    const result = await sql`SELECT version()`;
    console.log('Database version:', result);
    return {
      success: true,
      message: 'Database connected',
      version: result,
    };
  } catch (error) {
    console.error('Error connecting to the database:', error);
    return {
      success: false,
      message: 'Database not connected',
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Funciones específicas para la tabla products
export const productQueries = {
  // Obtener todos los productos
  async getAll() {
    return await db.query.products.findMany();
  },

  // Obtener un producto por ID
  async getById(id: number) {
    return await db.query.products.findFirst({
      where: (products, { eq }) => eq(products.id, id),
    });
  },

  // Obtener productos destacados
  async getFeatured() {
    return await db.query.products.findMany({
      where: (products, { eq }) => eq(products.destacado, true),
    });
  },

  // Obtener productos por categoría
  async getByCategory(category: string) {
    return await db.query.products.findMany({
      where: (products, { eq }) => eq(products.category, category),
    });
  },
};
