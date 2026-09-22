import { queryDatabase } from '@/lib/db/query';
import { withTransaction } from '@/lib/db/transaction';
import type { PoolClient } from 'pg';
export type Memory = {id:string;content:string;origin:'person_request'|'atlas_suggestion';confidence:'stated'|'inferred';created_at:Date;updated_at:Date};
export async function memoryConsent(userId:string, client?:PoolClient):Promise<boolean|null> {
 const result = await (client ? client.query.bind(client) : queryDatabase)("SELECT granted FROM consent_records WHERE user_id=$1 AND consent_type='memory' ORDER BY recorded_at DESC,id DESC LIMIT 1",[userId]);
 return result.rows[0]?.granted ?? null;
}
export async function listMemories(userId:string) {
 return (await queryDatabase<Memory>('SELECT id,content,origin,confidence,created_at,updated_at FROM memories WHERE user_id=$1 ORDER BY created_at DESC,id DESC',[userId])).rows;
}
export async function memoryTransaction<T>(userId:string, operation:(client:PoolClient)=>Promise<T>) {
 return withTransaction(async client => {
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`memory:${userId}`]);
 return operation(client);
 });
}
export function validMemoryContent(value:unknown):value is string {
 return typeof value==='string' && value.trim().length>0 && [...value].length<=500;
}
