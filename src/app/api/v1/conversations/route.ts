import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/server/auth/requireCurrentUser";
import { createConversationWithFirstPersonMessage } from
"@/server/services/conversationService";
import { validateFirstMessage } from
"@/server/validation/conversationValidation";
type CreateConversationRequest = {
content?: unknown;
};
export async function POST(request: Request) {
const user = await requireCurrentUser();
let body: CreateConversationRequest;
try {
body = (await request.json()) as CreateConversationRequest;
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
const validation = validateFirstMessage(body.content);
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
const conversation =
await createConversationWithFirstPersonMessage(
user.id,
validation.content,
);
return NextResponse.json(
{
data: conversation,
},
{
status: 201,
},
);
} catch {
console.error("Conversation creation failed.");
return NextResponse.json(
{
error: {
code: "CONVERSATION_CREATION_FAILED",
message: "Atlas could not create the conversation.",
},
},
{
status: 500,
},
);
}
}
