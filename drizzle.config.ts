import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import { parse } from 'pg-connection-string';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Parse the connection string
const connectionString = process.env.DATABASE_URL!;
const { host, port, user, password, database } = parse(connectionString);

export default {
  schema: './lib/schema.ts',
  out: './drizzle',
  dbCredentials: {
    host: host || 'localhost',
    port: port ? parseInt(port) : 5432,
    user: user || '',
    password: password || '',
    database: database || '',
    ssl: 'require'  // Important for Neon and other cloud providers
  },
  dialect: 'postgresql',
} satisfies Config;