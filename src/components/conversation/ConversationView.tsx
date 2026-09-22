import type {
MessageRecord,
} from "@/server/repositories/messageRepository";
type ConversationViewProps = {
messages: MessageRecord[];
};
export function ConversationView({
messages,
}: ConversationViewProps) {
return (
<section
aria-label="Conversation"
className="flex flex-1 flex-col py-8"
>
<div className="flex-1 space-y-6">
{messages.map((message) => (
<article
key={message.id}
className={
message.role === "person"
? "ml-auto max-w-[85%]"
: "mr-auto max-w-[85%]"
}
>
<p
className="whitespace-pre-wrap"
style={{
color:
"var(--atlas-color-text-primary)",
}}
>
{message.content}
</p>
</article>
))}
</div>
</section>
);
}
