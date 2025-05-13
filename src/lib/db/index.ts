import * as schema from './pg/schema.pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Create new connection with schema
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/postgres',
});

// Create properly typed db instance with schema
export const db = drizzle(pool, { schema });

// Export schema for easy access elsewhere
export * from './pg/schema.pg';

export * from './repository'; 