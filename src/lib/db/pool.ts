import { Pool } from "pg";
import { env } from "@/lib/env";
const globalForDatabase = globalThis as unknown as {
atlasDatabasePool?: Pool;
};
export const dbPool =
globalForDatabase.atlasDatabasePool ??
new Pool({
connectionString: env.databaseUrl,
max: 10,
idleTimeoutMillis: 30_000,
connectionTimeoutMillis: 5_000,
});
if (process.env.NODE_ENV !== "production") {
globalForDatabase.atlasDatabasePool = dbPool;
}
