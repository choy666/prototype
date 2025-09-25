import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Client } from 'pg';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { config } from 'dotenv';
config({ path: '.env.local' });
// Obtener __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración
const backupDir = join(__dirname, '../backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = join(backupDir, `backup-${timestamp}.sql`);

// Crear directorio de respaldos
if (!existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
}

// Función para ejecutar comandos
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

// Función principal
async function createBackup() {
  console.log('Creando respaldo...');
  console.log('Backup file:', backupFile);
  try {
    console.log('Conectando a la base de datos...');
    // Obtener la configuración de conexión
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Solo para desarrollo
      }
    });

    // Conectar a la base de datos
    await client.connect();
    
    // Obtener lista de tablas
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tables = res.rows.map(row => row.table_name);
    
    // Usar pg_dump si está disponible
    try {
      const pgDumpCommand = `pg_dump ${process.env.DATABASE_URL} > "${backupFile}"`;
      await executeCommand(pgDumpCommand);
    } catch (pgDumpError) {
      console.error(`Error al crear el respaldo con pg_dump: ${pgDumpError.message}`);
      // Método alternativo: exportar cada tabla
      let backupSQL = '';
      
      // Obtener esquema
      const schemaRes = await client.query(`
        SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);
      
      // Generar CREATE TABLE
      const tablesData = {};
      schemaRes.rows.forEach(row => {
        if (!tablesData[row.table_name]) {
          tablesData[row.table_name] = [];
        }
        tablesData[row.table_name].push(row);
      });
      
      // Generar SQL
      for (const [table, columns] of Object.entries(tablesData)) {
        // Crear tabla
        backupSQL += `--\n-- Estructura para la tabla ${table}\n--\n\n`;
        backupSQL += `DROP TABLE IF EXISTS "${table}" CASCADE;\n\n`;
        backupSQL += `CREATE TABLE "${table}" (\n`;
        
        const columnDefs = columns.map(col => {
          let def = `  "${col.column_name}" ${col.data_type}`;
          if (col.column_default) {
            def += ` DEFAULT ${col.column_default}`;
          }
          if (col.is_nullable === 'NO') {
            def += ' NOT NULL';
          }
          return def;
        });
        
        backupSQL += columnDefs.join(',\n') + '\n);\n\n';
        
        // Insertar datos
        const dataRes = await client.query(`SELECT * FROM "${table}"`);
        if (dataRes.rows.length > 0) {
          backupSQL += `--\n-- Datos para la tabla ${table}\n--\n\n`;
          backupSQL += `INSERT INTO "${table}" (${columns.map(c => `"${c.column_name}"`).join(', ')}) VALUES\n`;
          
          const rows = dataRes.rows.map(row => {
            const values = columns.map(col => {
              const val = row[col.column_name];
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              return val;
            });
            return `(${values.join(', ')})`;
          });
          
          backupSQL += rows.join(',\n') + ';\n\n';
        }
      }
      
      // Guardar en archivo
      console.log('💾 Guardando respaldo...');
      writeFileSync(backupFile, backupSQL);
      console.log('✅ Respaldo guardado correctamente');
    }
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear el respaldo:');
    console.error(error);
    process.exit(1);
  } finally {
    console.log('🏁 Proceso finalizado');
  }
}

// Ejecutar
createBackup();