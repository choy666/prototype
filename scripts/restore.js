const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

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
console.log(`🔍 Archivo de respaldo seleccionado: ${files[0]}`);

// Función para ejecutar consultas
async function executeQuery(client, query) {
  try {
    await client.query(query);
    console.log('✅ Consulta ejecutada correctamente');
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
    console.log('🔄 Conectado a la base de datos...');

    // Leer archivo SQL
    const sql = fs.readFileSync(latestBackup, 'utf8');
    
    // Ejecutar el script SQL
    console.log('🔄 Restaurando base de datos...');
    await client.query(sql);
    
    console.log('✅ Base de datos restaurada correctamente');
  } catch (error) {
    console.error('❌ Error al restaurar la base de datos:', error);
  } finally {
    await client.end();
  }
}

// Ejecutar
restoreBackup();