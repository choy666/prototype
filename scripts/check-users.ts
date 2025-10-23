#!/usr/bin/env tsx

import { db } from '../lib/db';
import { users } from '../lib/schema';

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

// Ejecutar verificación
checkUsers().catch(console.error);
