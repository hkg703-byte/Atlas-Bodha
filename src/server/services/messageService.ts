import type { PoolClient } from "pg";
import { withTransaction } from "@/lib/db/transaction";
export type CreatedPersonMessage = {
id: string;
conversationId: string;
sequenceNumber: string;
role: "person";
content: string;
createdAt: Date;
};
type ConversationLockRow = {
id: string;
};
type SequenceRow = {
next_sequence_number: string;
};
type MessageInsertRow = {
id: string;
conversation_id: string;
sequence_number: string;
content: string;
created_at: Date;
};
export async function appendPersonMessage(
userId: string,
conversationId: string,
content: string,
): Promise<CreatedPersonMessage | null> {
return withTransaction(async (client: PoolClient) => {
/*
* Lock the Conversation row.
*
* This accomplishes two things:
* 1. Verifies that the Conversation belongs to this User.
* 2. Serializes concurrent message appends to this Conversation.
*/
const conversationResult =
await client.query<ConversationLockRow>(
`
SELECT id
FROM conversations
WHERE id = $1
AND user_id = $2
FOR UPDATE;
`,
[conversationId, userId],
);
const conversation = conversationResult.rows[0];
if (!conversation) {
return null;
}
const active = await client.query("SELECT id FROM assistant_generations WHERE conversation_id = $1 AND status = 'pending' AND expires_at > NOW()", [conversationId]);
if (active.rowCount) throw new Error("Atlas is already responding.");
/*
* Since this Conversation is locked for this transaction,
* another append cannot simultaneously calculate the same
* next sequence number through this service.
*/
const sequenceResult =
await client.query<SequenceRow>(
`
SELECT
(COALESCE(MAX(sequence_number), 0) + 1)::text
AS next_sequence_number
FROM messages
WHERE conversation_id = $1;
`,
[conversation.id],
);
const sequence = sequenceResult.rows[0];
if (!sequence) {
throw new Error(
"Could not determine the next message sequence.",
);
}
const messageResult =
await client.query<MessageInsertRow>(
`
INSERT INTO messages (
conversation_id,
sequence_number,
role,
content
)
VALUES ($1, $2, 'person', $3)
RETURNING
id,
conversation_id,
sequence_number,
content,
created_at;
`,
[
conversation.id,
sequence.next_sequence_number,
content,
],
);
const message = messageResult.rows[0];
if (!message) {
throw new Error(
"Message insertion returned no record.",
);
}
await client.query(
`
UPDATE conversations
SET updated_at = NOW()
WHERE id = $1;
`,
[conversation.id],
);
return {
id: message.id,
conversationId: message.conversation_id,
sequenceNumber: message.sequence_number,
role: "person",
content: message.content,
createdAt: message.created_at,
};
});
}
