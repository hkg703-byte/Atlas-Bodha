import { requireCurrentUser } from "@/server/auth/requireCurrentUser";
import { hasValidRequestOrigin } from "@/server/auth/origin";
import { encodeStreamEvent, SAFETY_RESOURCES, type AtlasStreamEvent } from "@/server/ai/streamEvents";
import { streamAssistantResponse } from "@/server/ai/orchestration/streamAssistantResponse";
import { persistAssistantMessage } from "@/server/services/assistantMessageService";
import { reserveAssistantGeneration, finishGeneration, LIMIT_MESSAGE, RESTING_MESSAGE } from "@/server/services/assistantGenerationService";

export const runtime = "nodejs";
export const maxDuration = 180;
type RouteContext = { params: Promise<{ conversationId: string }> };
export async function POST(request: Request, context: RouteContext) {
  if (!hasValidRequestOrigin(request)) return Response.json({ error: { message: "Invalid request origin." } }, { status: 403 });
  const user = await requireCurrentUser();
  const { conversationId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return Response.json({ error: { message: "Conversation not found." } }, { status: 404 });
  const reservation = await reserveAssistantGeneration(user.id, conversationId);
  if (reservation.state === "missing") return Response.json({ error: { code: "CONVERSATION_NOT_FOUND", message: "Conversation not found." } }, { status: 404 });
  let cancelled = false;
  const abortController = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AtlasStreamEvent) => { if (!cancelled) controller.enqueue(encodeStreamEvent(event)); };
      try {
        emit({ type: "start" });
        if (reservation.state !== "reserved") {
          if (reservation.state === "complete") emit({ type: "complete" });
          else emit({ type: "error", message: reservation.state === "limit" ? LIMIT_MESSAGE : reservation.state === "resting" ? RESTING_MESSAGE : "Atlas is already responding. Please wait a moment." });
          return;
        }
        const { stream: aiStream, safetyTier } = await streamAssistantResponse({
          userId: user.id, conversationId, signal: abortController.signal,
          onSafety: tier => emit({ type: "safety", tier, resources: tier >= 2 ? SAFETY_RESOURCES : null }),
        });
        let completeText = "";
        for await (const text of aiStream) {
          if (cancelled) throw new Error("Stream cancelled.");
          completeText += text;
          emit({ type: "delta", text });
        }
        if (cancelled) throw new Error("Stream cancelled.");
        const persisted = await persistAssistantMessage(user.id, conversationId, completeText, safetyTier, reservation.reservation);
        if (!persisted) throw new Error("Conversation unavailable.");
        emit({ type: "complete" });
      } catch {
        // Never log raw upstream errors, request data, credentials or conversation text.
        if (reservation.state === "reserved") await finishGeneration(reservation.reservation.id, "failed").catch(() => {});
        emit({ type: "error", message: RESTING_MESSAGE });
      } finally {
        if (!cancelled) controller.close();
      }
    },
    async cancel() {
      cancelled = true;
      abortController.abort();
      if (reservation.state === "reserved") await finishGeneration(reservation.reservation.id, "failed").catch(() => {});
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
