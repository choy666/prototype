import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

// Directorio de respaldos
const backupDir = path.join(__dirname, '../backups');

// Obtener el archivo más reciente
const files = fs.readdirSync(backupDir)
  .filter(file => file.endsWith('.sql'))
  .sort()
  .reverse();

if (files.length === 0) {
  console.error('❌ No se encontraron archivos de respaldo');
  process.exit(1);
}

const latestBackup = path.join(backupDir, files[0]);

// Función para ejecutar consultas
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function executeQuery(client, query) {
  try {
    await client.query(query);
  } catch (error) {
    console.error('❌ Error al ejecutar consulta:', error.message);
  }
}

// Función principal
async function restoreBackup() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Solo para desarrollo
    }
  });

  try {
    // Conectar a la base de datos
    await client.connect();

    // Leer archivo SQL
    const sql = fs.readFileSync(latestBackup, 'utf8');
    
    // Ejecutar el script SQL
    await client.query(sql);
    
    // eslint-disable-next-line no-console
    console.log('✅ Base de datos restaurada correctamente');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Error al restaurar la base de datos:', error);
  } finally {
    await client.end();
  }
}

// Ejecutar
restoreBackup();