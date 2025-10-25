#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '../lib/db';
import { users } from '../lib/schema';
import bcrypt from 'bcryptjs';

async function checkUsers() {
  console.log('🔍 Verificando usuarios existentes...\n');

  try {
    const existingUsers = await db.select().from(users).limit(10);
    console.log(`✅ Encontrados ${existingUsers.length} usuarios:`);

    existingUsers.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`);
    });

    if (existingUsers.length > 0) {
      console.log(`\n💡 Usando el primer usuario (ID: ${existingUsers[0].id}) para pruebas`);
      return existingUsers[0].id;
    } else {
      console.log('\n❌ No hay usuarios en la base de datos');
      return null;
    }

  } catch (error) {
    console.error('❌ Error al consultar usuarios:', error);
    return null;
  }
}

async function createTestUser() {
  try {
    console.log('🛠️ Creando usuario de prueba...');

    const hashedPassword = bcrypt.hashSync('testpass123', 10);

    const result = await db.insert(users).values({
      email: 'test@example.com',
      name: 'Usuario de Prueba',
      password: hashedPassword,
      role: 'user'
    }).returning();

    console.log('✅ Usuario de prueba creado exitosamente:', result[0]);
  } catch (error) {
    console.error('❌ Error creando usuario de prueba:', error instanceof Error ? error.message : String(error));
  } finally {
    process.exit(0);
  }
}

async function createAdminUser() {
  try {
    console.log('🛠️ Creando usuario administrador...');

    const hashedPassword = bcrypt.hashSync('admin123', 10);

    const result = await db.insert(users).values({
      email: 'admin@example.com',
      name: 'Administrador',
      password: hashedPassword,
      role: 'admin'
    }).returning();

    console.log('✅ Usuario administrador creado exitosamente:', result[0]);
  } catch (error) {
    console.error('❌ Error creando usuario administrador:', error instanceof Error ? error.message : String(error));
  } finally {
    process.exit(0);
  }
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'check':
      await checkUsers();
      break;
    case 'create-test':
      await createTestUser();
      break;
    case 'create-admin':
      await createAdminUser();
      break;
    default:
      console.log('Uso: tsx user-manager.ts [check|create-test|create-admin]');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { checkUsers, createTestUser };
