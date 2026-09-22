import { queryDatabase } from "@/lib/db/query";
export type ConversationRecord = {
id: string;
user_id: string;
created_at: Date;
updated_at: Date;
};
export async function createConversation(
userId: string,
): Promise<ConversationRecord> {
const result = await queryDatabase<ConversationRecord>(
`
INSERT INTO conversations (user_id)
VALUES ($1)
RETURNING
id,
user_id,
created_at,
updated_at;
`,
[userId],
);
return result.rows[0];
}
export async function findConversationById(
conversationId: string,
userId: string,
): Promise<ConversationRecord | null> {
const result = await queryDatabase<ConversationRecord>(
`
SELECT
id,
user_id,
created_at,
updated_at
FROM conversations
WHERE id = $1
AND user_id = $2
LIMIT 1;
`,
[conversationId, userId],
);
return result.rows[0] ?? null;
}
