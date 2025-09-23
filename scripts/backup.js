const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { exec } = require('child_process');

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

// Configuración
const backupDir = path.join(__dirname, '../backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

// Crear directorio de respaldos
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
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
      console.log(`stdout: ${stdout}`);
      resolve(stdout);
    });
  });
}

// Función principal
async function createBackup() {
  try {
    // Obtener la configuración de conexión
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Solo para desarrollo
      }
    });

    // Conectar a la base de datos
    await client.connect();
    console.log('🔄 Conectado a la base de datos...');

    // Obtener lista de tablas
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tables = res.rows.map(row => row.table_name);
    console.log('📋 Tablas encontradas:', tables.join(', '));

    // Crear respaldo
    console.log('💾 Creando respaldo...');
    
    // Usar pg_dump si está disponible
    try {
      const pgDumpCommand = `pg_dump ${process.env.DATABASE_URL} > "${backupFile}"`;
      await executeCommand(pgDumpCommand);
      console.log(`✅ Respaldo creado en: ${backupFile}`);
    } catch (e) {
      console.log('ℹ️ pg_dump no disponible, usando método alternativo...');
      
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
      fs.writeFileSync(backupFile, backupSQL);
      console.log(`✅ Respaldo creado en: ${backupFile} (método alternativo)`);
    }
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear el respaldo:', error);
    process.exit(1);
  }
}

// Ejecutar
createBackup();