import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { Pool, type PoolClient } from "pg";
loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const dir = join(process.cwd(), "database", "migrations");
const pool = new Pool({ connectionString, max: 1 });
const required: Record<string, Record<string, string[]>> = { "001_initial_schema.sql": { users: ["id", "created_at", "updated_at"], conversations: ["id", "user_id"], messages: ["id", "conversation_id", "sequence_number", "role", "content"] }, "002_auth.sql": { external_identities: ["id", "user_id", "provider", "subject", "password_hash"], auth_sessions: ["id", "user_id", "token_hash", "expires_at"] }, "002_message_idempotency.sql": { idempotency_keys: ["id", "user_id", "key", "operation"] } };
async function present(c: PoolClient, name: string) { const tables = required[name]; if (!tables) return false; for (const [table, columns] of Object.entries(tables)) { const r = await c.query<{column_name:string}>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table]); if (!columns.every((column) => r.rows.some((row) => row.column_name === column))) return false; } return true; }
async function main() { const c = await pool.connect(); try { await c.query("SELECT pg_advisory_lock(hashtext('atlas-bodha-schema-migrations'))"); await c.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`); const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort(); for (const name of files) { if ((await c.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name])).rowCount) continue; await c.query("BEGIN"); try { if (!(await present(c, name))) { const sql = (await readFile(join(dir, name), "utf8")).replace(/^\s*BEGIN;?\s*/i, "").replace(/\s*COMMIT;?\s*$/i, ""); await c.query(sql); } await c.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]); await c.query("COMMIT"); process.stdout.write(`Applied ${name}\n`); } catch (e) { await c.query("ROLLBACK"); throw e; } } await c.query("SELECT pg_advisory_unlock(hashtext('atlas-bodha-schema-migrations'))"); } finally { c.release(); await pool.end(); } }
main().catch(() => { process.stderr.write("Database migration failed\n"); process.exitCode = 1; });
