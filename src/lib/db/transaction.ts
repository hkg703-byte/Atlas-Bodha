import type { PoolClient } from "pg";
import { dbPool } from "@/lib/db/pool";
export async function withTransaction<T>(
operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
const client = await dbPool.connect();
try {
await client.query("BEGIN");
const result = await operation(client);
await client.query("COMMIT");
return result;
} catch (error) {
await client.query("ROLLBACK");
throw error;
} finally {
client.release();
}
}
