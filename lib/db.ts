import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { and, or, eq, ne, gt, gte, lt, lte, like, inArray, isNull, sql } from 'drizzle-orm';

// Configuración de la conexión
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno');
}

// Configuración de Neon (opcional: para mejorar rendimiento)
neonConfig.fetchConnectionCache = true;

// Crear la conexión a la base de datos
const sqlClient = neon(process.env.DATABASE_URL);

export const db = drizzle(sqlClient, { 
  schema,
  logger: process.env.NODE_ENV === 'development' ? {
    logQuery(query, params) {
      console.log('Query:', query);
      if (params.length) console.log('Params:', params);
    }
  } : false,
});

// Tipos exportados para facilitar el uso
export type Database = typeof schema;

// Función para verificar la conexión
export async function checkDbConnection() {
  try {
    await sqlClient`SELECT 1`;
    console.log('✅ Conexión a la base de datos establecida correctamente');
    return { success: true, message: 'Database connected' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error al conectar a la base de datos:', error);
    return { success: false, message: `Connection failed: ${errorMessage}` };
  }
}

// Funciones específicas para la tabla products
export const productQueries = {
  // Obtener todos los productos con paginación
  async getAll(limit = 50, offset = 0) {
    return await db.query.products.findMany({
      limit,
      offset,
      orderBy: (products, { desc }) => [desc(products.updated_at)],
    });
  },

  // Obtener un producto por ID
  async getById(id: number) {
    const [product] = await db.query.products.findMany({
      where: (products, { eq }) => eq(products.id, id),
      limit: 1,
    });
    return product || null;
  },

  // Obtener productos destacados
  async getFeatured(limit = 10) {
    return await db.query.products.findMany({
      where: (products, { eq }) => eq(products.destacado, true),
      limit,
      orderBy: (products, { desc }) => [desc(products.updated_at)],
    });
  },

  // Obtener productos por categoría
  async getByCategory(category: string) {
    return await db.query.products.findMany({
      where: (products, { eq }) => eq(products.category, category),
    });
  },
};

// Re-exportar operadores para consultas
export { and, or, eq, ne, gt, gte, lt, lte, like, inArray, isNull, sql };