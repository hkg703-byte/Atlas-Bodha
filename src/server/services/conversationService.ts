import type { PoolClient } from "pg";
import { withTransaction } from "@/lib/db/transaction";
export type CreatedConversation = {
conversationId: string;
message: {
id: string;
sequenceNumber: string;
role: "person";
content: string;
createdAt: Date;
};
};
type ConversationInsert = {
id: string;
};
type MessageInsert = {
id: string;
sequence_number: string;
content: string;
created_at: Date;
};
export async function createConversationWithFirstPersonMessage(
userId: string,
content: string,
): Promise<CreatedConversation> {
return withTransaction(async (client: PoolClient) => {
const conversationResult = await client.query<ConversationInsert>(
`
INSERT INTO conversations (user_id)
VALUES ($1)
RETURNING id;
`,
[userId],
);
const conversation = conversationResult.rows[0];
if (!conversation) {
throw new Error("Conversation creation returned no record.");
}
const messageResult = await client.query<MessageInsert>(
`
INSERT INTO messages (
conversation_id,
sequence_number,
role,
content
)
VALUES ($1, $2, $3, $4)
RETURNING
id,
sequence_number,
content,
created_at;
`,
[
conversation.id,
1,
"person",
content,
],
);
const message = messageResult.rows[0];
if (!message) {
throw new Error("Message creation returned no record.");
}
return {
conversationId: conversation.id,
message: {
id: message.id,
sequenceNumber: message.sequence_number,
role: "person",
content: message.content,
createdAt: message.created_at,
},
};
});
}
