import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '../lib/db';
import { users } from '../lib/schema';
import bcrypt from 'bcryptjs';

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

createTestUser();
