import { queryDatabase } from "@/lib/db/query";
export type MessageRole = "person" | "assistant";
export type MessageRecord = {
id: string;
conversation_id: string;
sequence_number: string;
role: MessageRole;
content: string;
created_at: Date;
};
export async function listMessages(
conversationId: string,
): Promise<MessageRecord[]> {
const result = await queryDatabase<MessageRecord>(
`
SELECT
id,
conversation_id,
sequence_number,
role,
content,
created_at
FROM messages
WHERE conversation_id = $1
ORDER BY sequence_number ASC;
`,
[conversationId],
);
return result.rows;
}
