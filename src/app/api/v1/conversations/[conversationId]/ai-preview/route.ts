import { requireCurrentUser } from "@/server/auth/requireCurrentUser";
import { hasValidRequestOrigin } from "@/server/auth/origin";
import { generateAssistantResponse } from "@/server/ai/orchestration/generateAssistantResponse";
import { reserveAssistantGeneration, finishGeneration, LIMIT_MESSAGE, RESTING_MESSAGE } from "@/server/services/assistantGenerationService";
import { SAFETY_RESOURCES } from "@/server/ai/streamEvents";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  if (!hasValidRequestOrigin(request)) return Response.json({ error: { message: "Invalid request origin." } }, { status: 403 });
  const user = await requireCurrentUser();
  const { conversationId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return Response.json({ error: { message: "Conversation not found." } }, { status: 404 });
  const result = await reserveAssistantGeneration(user.id, conversationId, "preview");
  if (result.state !== "reserved") return Response.json({ error: { message: result.state === "limit" ? LIMIT_MESSAGE : "Atlas could not begin the response." } }, { status: result.state === "missing" ? 404 : 409 });
  try {
    const generated = await generateAssistantResponse({ userId: user.id, conversationId });
    await finishGeneration(result.reservation.id, "completed");
    return Response.json({ data: { ...generated, resources: generated.safetyTier >= 2 ? SAFETY_RESOURCES : null } });
  } catch {
    await finishGeneration(result.reservation.id, "failed").catch(() => {});
    return Response.json({ error: { code: "AI_GENERATION_FAILED", message: RESTING_MESSAGE } }, { status: 502 });
  }
}
