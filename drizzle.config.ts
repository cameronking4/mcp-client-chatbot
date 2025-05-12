import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config();

const dialect = "postgresql"; 
// const dialect = process.env.USE_FILE_SYSTEM_DB ? "sqlite" : "postgresql";


const url = process.env.POSTGRES_URL!;
  // process.env.USE_FILE_SYSTEM_DB === "true"
  //   ? process.env.FILEBASE_URL!
  //   : process.env.POSTGRES_URL!;

const schema = "./src/lib/db/pg/schema.pg.ts";
  // process.env.USE_FILE_SYSTEM_DB === "true"
  //   ? "./src/lib/db/sqlite/schema.sqlite.ts"
  //   : "./src/lib/db/pg/schema.pg.ts";

const out = "./src/lib/db/migrations/pg";
  // process.env.USE_FILE_SYSTEM_DB === "true"
  //   ? "./src/lib/db/migrations/sqlite"
  //   : "./src/lib/db/migrations/pg";

export default defineConfig({
  schema,
  out,
  dialect,
  migrations: {},
  dbCredentials: {
    url,
  },
});
