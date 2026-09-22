import { notFound } from "next/navigation";
import { ConversationExperience } from
"@/components/conversation/ConversationExperience";
import { AppShell } from "@/components/layout/AppShell";
import { requireCurrentUser } from "@/server/auth/requireCurrentUser";
import { findConversationById } from
"@/server/repositories/conversationRepository";
import { listMessagesForUserConversation } from
"@/server/repositories/messageRepository";
type ConversationPageProps = {
params: Promise<{
conversationId: string;
}>;
};
export default async function ConversationPage({
params,
}: ConversationPageProps) {
const user = await requireCurrentUser();
const { conversationId } = await params;
const conversation =
await findConversationById(
conversationId,
user.id,
);
if (!conversation) {
notFound();
}
const messages =
await listMessagesForUserConversation(
conversation.id,
user.id,
);
return (
<AppShell>
<ConversationExperience
conversationId={conversation.id}
messages={messages.map((message) => ({
id: message.id,
sequenceNumber: message.sequence_number,
role: message.role,
content: message.content,
safetyTier: message.safety_tier,
}))}
/>
</AppShell>
);
}
