import { hasValidRequestOrigin } from "@/server/auth/origin";
import { listMessagesForUserConversation } from "@/server/repositories/messageRepository";
import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/server/auth/requireCurrentUser";
import { appendPersonMessage } from "@/server/services/messageService";
import { validatePersonMessage } from
"@/server/validation/messageValidation";
type RouteContext = {
params: Promise<{
conversationId: string;
}>;
};
type CreateMessageRequest = {
content?: unknown;
};
export async function POST(
request: Request,
context: RouteContext,
) {
if (!hasValidRequestOrigin(request)) return Response.json({ error: { message: "Invalid request origin." } }, { status: 403 });
const user = await requireCurrentUser();
const { conversationId } = await context.params;
let body: CreateMessageRequest;
try {
body = (await request.json()) as CreateMessageRequest;
} catch {
return NextResponse.json(
{
error: {
code: "INVALID_JSON",
message: "The request body must contain valid JSON.",
},
},
{
status: 400,
},
);
}
const validation =
validatePersonMessage(body.content);
if (!validation.valid) {
return NextResponse.json(
{
error: {
code: "INVALID_MESSAGE",
message: validation.error,
},
},
{
status: 400,
},
);
}
try {
const message = await appendPersonMessage(
user.id,
conversationId,
validation.content,
);
if (!message) {
return NextResponse.json(
{
error: {
code: "CONVERSATION_NOT_FOUND",
message: "Conversation not found.",
},
},
{
status: 404,
},
);
}
return NextResponse.json(
{
data: {
message,
},
},
{
status: 201,
},
);
} catch {
console.error("Person Message creation failed.");
return NextResponse.json(
{
error: {
code: "MESSAGE_CREATION_FAILED",
message:
"Atlas could not save the message.",
},
},
{
status: 500,
},
);
}
}
export async function GET(
_request: Request,
context: RouteContext,
) {
const user = await requireCurrentUser();
const { conversationId } = await context.params;
const messages =
await listMessagesForUserConversation(
conversationId,
user.id,
);
return NextResponse.json({
data: {
messages: messages.map((message) => ({
id: message.id,
conversationId:
message.conversation_id,
sequenceNumber:
message.sequence_number,
role: message.role,
content: message.content,
createdAt: message.created_at,
safetyTier: message.safety_tier,
})),
},
});
}
