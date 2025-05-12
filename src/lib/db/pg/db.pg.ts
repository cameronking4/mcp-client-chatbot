import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL!,
});

export const pgDb = drizzlePg(pool);
