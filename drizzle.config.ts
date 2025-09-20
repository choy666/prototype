// drizzle.config.ts
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
    port: port ? parseInt(port as string) : 5432,
    user: user || 'postgres',
    password: password || '',
    database: database || '',
    ssl: 'require'
  },
  dialect: 'postgresql'
} satisfies Config;
