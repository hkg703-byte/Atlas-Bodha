import { notFound } from "next/navigation";
import { ConversationComposer } from
"@/components/conversation/ConversationComposer";
import { ConversationView } from
"@/components/conversation/ConversationView";
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
<div className="flex min-h-0 flex-1 flex-col">
<ConversationView
messages={messages}
/>
<div className="sticky bottom-0 bg-[var(--atlas-color-background)]
pb-2 pt-4">
<ConversationComposer
conversationId={conversation.id}
/>
</div>
</div>
</AppShell>
);
}
