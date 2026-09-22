import { queryDatabase } from "@/lib/db/query";
export type UserRecord = {
id: string;
created_at: Date;
updated_at: Date;
};
export async function createUser(): Promise<UserRecord> {
const result = await queryDatabase<UserRecord>(`
INSERT INTO users
DEFAULT VALUES
RETURNING
id,
created_at,
updated_at;
`);
return result.rows[0];
}
export async function findUserById(
userId: string,
): Promise<UserRecord | null> {
const result = await queryDatabase<UserRecord>(
`
SELECT
id,
created_at,
updated_at
FROM users
WHERE id = $1
LIMIT 1;
`,
[userId],
);
return result.rows[0] ?? null;
}
