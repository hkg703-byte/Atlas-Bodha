"use client";
import {
FormEvent,
KeyboardEvent,
useState,
} from "react";
import { useRouter } from "next/navigation";
type CreateConversationResponse = {
data?: {
conversationId: string;
};
error?: {
code: string;
message: string;
};
};
export function MessageComposer() {
const router = useRouter();
const [message, setMessage] = useState("");
const [isSubmitting, setIsSubmitting] = useState(false);
const [errorMessage, setErrorMessage] =
useState<string | null>(null);
async function submitMessage() {
const trimmedMessage = message.trim();
if (!trimmedMessage || isSubmitting) {
return;
}
setIsSubmitting(true);
setErrorMessage(null);
try {
const response = await fetch("/api/v1/conversations", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
content: trimmedMessage,
}),
});
const result =
(await response.json()) as CreateConversationResponse;
if (!response.ok || !result.data) {
throw new Error(
result.error?.message ??
"Atlas could not create the conversation.",
);
}
setMessage("");
router.push(
`/conversations/${result.data.conversationId}`,
);
} catch (error) {
const message =
error instanceof Error
? error.message
: "Atlas could not create the conversation.";
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
borderColor: "var(--atlas-color-border)",
borderRadius: "var(--atlas-radius-medium)",
}}
>
<label
htmlFor="atlas-message"
className="sr-only"
>
Message Atlas
</label>
<textarea
id="atlas-message"
value={message}
onChange={(event) => {
setMessage(event.target.value);
if (errorMessage) {
setErrorMessage(null);
}
}}
onKeyDown={handleKeyDown}
enterKeyHint="send"
autoFocus
placeholder="Bring what matters to you..."
rows={1}
disabled={isSubmitting}
className="min-h-12 flex-1 border-0 bg-transparent p-3 outline-none
disabled:opacity-60"
style={{
color: "var(--atlas-color-text-primary)",
}}
/>
<button
type="submit"
disabled={!message.trim() || isSubmitting}
className="min-h-11 rounded-lg px-5 text-white transition-opacity
disabled:cursor-default disabled:opacity-40"
style={{
background: "var(--atlas-color-accent)",
}}
>
{isSubmitting ? "Sending…" : "Send"}
</button>
</form>
<p
className="mt-2 whitespace-nowrap text-center text-xs"
style={{ color: "var(--atlas-color-text-secondary)" }}
>
Atlas is an AI, not a person or a therapist.
</p>
{errorMessage ? (
<p
role="alert"
className="mt-3 text-sm"
style={{
color: "var(--atlas-color-text-secondary)",
}}
>
{errorMessage}
</p>
) : null}
</div>
);
}
