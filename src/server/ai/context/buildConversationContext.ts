import type { AiConversationMessage } from "@/server/ai/providers/aiProvider";
import { listMessagesForUserConversation } from "@/server/repositories/messageRepository";

type BuildConversationContextInput = {
userId: string;
conversationId: string;
};

export async function buildConversationContext({
userId,
conversationId,
}: BuildConversationContextInput): Promise<AiConversationMessage[]> {
const messages = await listMessagesForUserConversation(conversationId, userId);
return messages.map((message) => ({
role: message.role === "person" ? "user" : "assistant",
content: message.content,
}));
}
