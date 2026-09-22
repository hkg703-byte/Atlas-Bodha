"use client";
import {
FormEvent,
KeyboardEvent,
useState,
} from "react";
import { useRouter } from "next/navigation";
type ConversationComposerProps = {
conversationId: string;
};
type CreateMessageResponse = {
data?: {
message: {
id: string;
conversationId: string;
sequenceNumber: string;
role: "person";
content: string;
createdAt: string;
};
};
error?: {
code: string;
message: string;
};
};
export function ConversationComposer({
conversationId,
}: ConversationComposerProps) {
const router = useRouter();
const [message, setMessage] = useState("");
const [isSubmitting, setIsSubmitting] =
useState(false);
const [errorMessage, setErrorMessage] =
useState<string | null>(null);
const [pendingIdempotencyKey, setPendingIdempotencyKey] =
useState<string | null>(null);
async function submitMessage() {
const content = message.trim();
if (!content || isSubmitting) {
return;
}
const idempotencyKey =
pendingIdempotencyKey ?? crypto.randomUUID();
setPendingIdempotencyKey(idempotencyKey);
setIsSubmitting(true);
setErrorMessage(null);
try {
const response = await fetch(
`/api/v1/conversations/${conversationId}/messages`,
{
method: "POST",
headers: {
"Content-Type": "application/json",
"Idempotency-Key": idempotencyKey,
},
body: JSON.stringify({
content,
}),
},
);
const result =
(await response.json()) as CreateMessageResponse;
if (!response.ok || !result.data) {
throw new Error(
result.error?.message ??
"Atlas could not save the message.",
);
}
setPendingIdempotencyKey(null);
setMessage("");
/*
* Re-render the current Server Component page,
* which retrieves canonical Messages again.
*/
router.refresh();
} catch (error) {
const message =
error instanceof Error
? error.message
: "Atlas could not save the message.";
setErrorMessage(message);
} finally {
setIsSubmitting(false);
}
}
async function handleSubmit(
event: FormEvent<HTMLFormElement>,
) {
event.preventDefault();
await submitMessage();
}
async function handleKeyDown(
event: KeyboardEvent<HTMLTextAreaElement>,
) {
if (
event.key === "Enter" &&
!event.shiftKey &&
!event.nativeEvent.isComposing
) {
event.preventDefault();
await submitMessage();
}
}
return (
<div>
<form
onSubmit={handleSubmit}
className="flex items-end gap-3 border bg-white p-3"
style={{
borderColor:
"var(--atlas-color-border)",
borderRadius:
"var(--atlas-radius-medium)",
}}
>
<label
htmlFor="atlas-conversation-message"
className="sr-only"
>
Message Atlas
</label>
<textarea
id="atlas-conversation-message"
value={message}
onChange={(event) => {
setMessage(event.target.value);
if (errorMessage) {
setErrorMessage(null);
}
}}
onKeyDown={handleKeyDown}
placeholder="Continue the conversation..."
rows={1}
disabled={isSubmitting}
className="min-h-12 flex-1 border-0 bg-transparent p-3 outline-none
disabled:opacity-60"
/>
<button
type="submit"
disabled={
!message.trim() || isSubmitting
}
className="min-h-11 rounded-lg px-5 text-white transition-opacity
disabled:cursor-default disabled:opacity-40"
style={{
background:
"var(--atlas-color-accent)",
}}
>
{isSubmitting
? "Sending…"
: "Send"}
</button>
</form>
{errorMessage ? (
<p
role="alert"
className="mt-3 text-sm"
style={{
color:
"var(--atlas-color-text-secondary)",
}}
>
{errorMessage}
</p>
) : null}
</div>
);
}
