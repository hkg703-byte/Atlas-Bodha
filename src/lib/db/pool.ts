import { Pool } from "pg";
import { env } from "@/lib/env";
const globalForDatabase = globalThis as unknown as { atlasDatabasePool?: Pool };
let pool: Pool | undefined;
function getPool(): Pool {
  if (pool) return pool;
  pool = globalForDatabase.atlasDatabasePool ?? new Pool({
    connectionString: env.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  if (process.env.NODE_ENV !== "production") globalForDatabase.atlasDatabasePool = pool;
  return pool;
}
// Next imports server modules while building. Credentials are required only when
// a runtime operation accesses the pool, never to compile the application.
export const dbPool = new Proxy({} as Pool, {
  get(_target, property) {
    const instance = getPool();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
