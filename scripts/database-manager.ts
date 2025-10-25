#!/usr/bin/env tsx

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Client } from 'pg';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { exec } from 'child_process';
import { config } from 'dotenv';
import { checkDatabaseConnection, checkCriticalTables } from '../lib/db.js';

config({ path: '.env.local' });

// Obtener __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de backups
const backupDir = join(__dirname, '../backups');

// Función para ejecutar comandos
function executeCommand(command: string): Promise<string> {
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

// Función para crear respaldo
async function createBackup() {
  console.log('Creando respaldo...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = join(backupDir, `backup-${timestamp}.sql`);

  // Crear directorio de respaldos
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  console.log('Backup file:', backupFile);

  try {
    console.log('Conectando a la base de datos...');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Solo para desarrollo
      }
    });

    await client.connect();

    // Usar pg_dump si está disponible
    try {
      const pgDumpCommand = `pg_dump ${process.env.DATABASE_URL} > "${backupFile}"`;
      await executeCommand(pgDumpCommand);
    } catch (pgDumpError) {
      console.error(`Error al crear el respaldo con pg_dump: ${(pgDumpError as Error).message}`);
      // Método alternativo: exportar cada tabla
      let backupSQL = '';

      // Obtener esquema
      const schemaRes = await client.query(`
        SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);

      const tablesData: Record<string, any[]> = {};
      schemaRes.rows.forEach(row => {
        if (!tablesData[row.table_name]) {
          tablesData[row.table_name] = [];
        }
        tablesData[row.table_name].push(row);
      });

      // Generar SQL
      for (const [table, columns] of Object.entries(tablesData)) {
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

      console.log('💾 Guardando respaldo...');
      writeFileSync(backupFile, backupSQL);
      console.log('✅ Respaldo guardado correctamente');
    }

    await client.end();
    console.log('🏁 Proceso finalizado');
  } catch (error) {
    console.error('❌ Error al crear el respaldo:', error);
    process.exit(1);
  }
}

// Función para restaurar respaldo
async function restoreBackup() {
  const files = readdirSync(backupDir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error('❌ No se encontraron archivos de respaldo');
    process.exit(1);
  }

  const latestBackup = join(backupDir, files[0]);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Solo para desarrollo
    }
  });

  try {
    await client.connect();
    const sql = require('fs').readFileSync(latestBackup, 'utf8');
    await client.query(sql);
    console.log('✅ Base de datos restaurada correctamente');
  } catch (error) {
    console.error('❌ Error al restaurar la base de datos:', error);
  } finally {
    await client.end();
  }
}

// Función para verificar salud de la base de datos
async function checkDatabaseHealth() {
  console.log('🔍 Verificando salud de la base de datos...\n');

  // Verificar conexión
  console.log('1. Verificando conexión...');
  const connectionResult = await checkDatabaseConnection();
  console.log(connectionResult.message);
  if (!connectionResult.success) {
    console.error('❌ Error de conexión:', connectionResult.error);
    process.exit(1);
  }

  // Verificar tablas críticas
  console.log('\n2. Verificando tablas críticas...');
  const tablesResult = await checkCriticalTables();
  if (tablesResult.success && tablesResult.tables) {
    console.log('✅ Verificación de tablas completada');
    for (const [table, info] of Object.entries(tablesResult.tables)) {
      const tableInfo = info as { exists: boolean; count?: number; error?: string };
      if (tableInfo.exists) {
        console.log(`   📊 ${table}: ${tableInfo.count} registros`);
      } else {
        console.error(`   ❌ ${table}: No existe - ${tableInfo.error}`);
      }
    }
  } else {
    console.error('❌ Error al verificar tablas:', tablesResult.error);
    process.exit(1);
  }

  console.log('\n✅ Verificación completada exitosamente');
}

// Función principal
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'backup':
      await createBackup();
      break;
    case 'restore':
      await restoreBackup();
      break;
    case 'health':
      await checkDatabaseHealth();
      break;
    default:
      console.log('Uso: tsx database-manager.ts [backup|restore|health]');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { createBackup, restoreBackup, checkDatabaseHealth };
