import type { QueryResultRow } from "pg";
import { dbPool } from "@/lib/db/pool";
export async function queryDatabase<T extends QueryResultRow>(
text: string,
values: unknown[] = [],
) {
return dbPool.query<T>(text, values);
}
