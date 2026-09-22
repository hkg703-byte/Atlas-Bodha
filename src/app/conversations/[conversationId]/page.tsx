import { notFound } from "next/navigation";
import { ConversationView } from
"@/components/conversation/ConversationView";
import { AppShell } from "@/components/layout/AppShell";
import { env } from "@/lib/env";
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
const { conversationId } = await params;
const conversation =
await findConversationById(
conversationId,
env.devUserId,
);
if (!conversation) {
notFound();
}
const messages =
await listMessagesForUserConversation(
conversation.id,
env.devUserId,
);
return (
<AppShell>
<ConversationView messages={messages} />
</AppShell>
);
}
