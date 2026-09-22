import { queryDatabase } from "@/lib/db/query";
export type MessageRole = "person" | "assistant";
export type MessageRecord = {
id: string;
conversation_id: string;
sequence_number: string;
role: MessageRole;
content: string;
created_at: Date;
safety_tier: number | null;
};
export async function listMessagesForUserConversation(
conversationId: string,
userId: string,
): Promise<MessageRecord[]> {
const result = await queryDatabase<MessageRecord>(
`
SELECT
m.id,
m.conversation_id,
m.sequence_number,
m.role,
m.content,
m.created_at,
m.safety_tier
FROM messages m
INNER JOIN conversations c
ON c.id = m.conversation_id
WHERE m.conversation_id = $1
AND c.user_id = $2
ORDER BY m.sequence_number ASC;
`,
[
conversationId,
userId,
],
);
return result.rows;
}
