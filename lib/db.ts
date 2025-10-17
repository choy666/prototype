// lib/db.ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import {
  and, or, eq, ne, gt, gte, lt, lte,
  like, inArray, isNull, sql
} from 'drizzle-orm'
import { z } from 'zod'

// 1. Validación de variables de entorno
const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL válida').optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const env = envSchema.safeParse(process.env)

if (!env.success) {
  console.error('❌ Error en la configuración del entorno:', env.error.format())
  throw new Error('Error en la configuración del entorno')
}

// 2. Tipos y declaraciones globales
declare global {
  // Evitamos múltiples instancias en hot reload y producción
  // eslint-disable-next-line no-var
  var drizzleClient: NeonHttpDatabase<typeof schema> | undefined
}
export {}

// 3. Configuración de la conexión
const createDrizzleClient = (): NeonHttpDatabase<typeof schema> => {
  try {
    const databaseUrl = env.data.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL no está definida');
    }
    const client = neon(databaseUrl) // 👈 sin { fullResults: true }

    return drizzle(client, {
      schema,
      logger:
        env.data.NODE_ENV === 'development'
          ? {
              logQuery: (query: string, params: unknown[] = []) => {
                console.log('📝 Query:', query)
                if (params.length) {
                  console.log('   Params:', params)
                }
              },
            }
          : false,
    })
  } catch (error) {
    console.error('❌ Error al crear el cliente de base de datos:', error)
    throw new Error('No se pudo conectar a la base de datos')
  }
}

// 4. Singleton unificado (dev y prod)
const getDrizzleClient = (): NeonHttpDatabase<typeof schema> => {
  if (!globalThis.drizzleClient) {
    console.log(
      env.data.NODE_ENV === 'development'
        ? '🔌 Creando nueva conexión a la base de datos para desarrollo...'
        : '🚀 Inicializando cliente de base de datos en producción...'
    )
    globalThis.drizzleClient = createDrizzleClient()
  }
  return globalThis.drizzleClient
}

// 5. Exportar la instancia de la base de datos
export const db = getDrizzleClient()

// 6. Tipos exportados
export type Database = typeof schema
export type { InferModel, InferSelectModel, InferInsertModel } from 'drizzle-orm'

// 7. Funciones útiles
export const dbUtils = {
  and,
  or,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  inArray,
  isNull,
  sql,
}

// 8. Función para verificar la conexión
export async function checkDatabaseConnection() {
  try {
    const result = await db.execute(sql`SELECT 1`)
    return {
      success: true,
      message: '✅ Conexión a la base de datos exitosa',
      rows: result,
    }
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:', error)
    return {
      success: false,
      message: 'Error al conectar a la base de datos',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}