import { withTransaction } from "@/lib/db/transaction";
import type { GenerationReservation } from "./assistantGenerationService";
import { validateAssistantOutput } from "@/server/ai/validation/validateAssistantOutput";
export type CreatedAssistantMessage = {
  id: string; conversationId: string; sequenceNumber: string; role: "assistant";
  content: string; createdAt: Date; safetyTier: number;
};
export async function persistAssistantMessage(userId: string, conversationId: string, content: string, safetyTier: number, reservation: GenerationReservation): Promise<CreatedAssistantMessage | null> {
  const validation = validateAssistantOutput(content);
  if (!validation.valid) throw new Error("Assistant output was not valid.");
  return withTransaction(async client => {
    const conversation = await client.query("SELECT id FROM conversations WHERE id = $1 AND user_id = $2 FOR UPDATE", [conversationId, userId]);
    if (!conversation.rowCount) return null;
    const pending = await client.query("SELECT id FROM assistant_generations WHERE id = $1 AND user_id = $2 AND conversation_id = $3 AND person_message_id = $4 AND status = 'pending' AND expires_at > NOW() FOR UPDATE", [reservation.id, userId, conversationId, reservation.personMessageId]);
    if (!pending.rowCount) throw new Error("Generation reservation expired.");
    const latest = await client.query<{id:string; role:string}>("SELECT id, role FROM messages WHERE conversation_id = $1 ORDER BY sequence_number DESC LIMIT 1", [conversationId]);
    if (latest.rows[0]?.id !== reservation.personMessageId || latest.rows[0]?.role !== "person") throw new Error("Conversation changed during generation.");
    const sequence = await client.query<{next_sequence_number:string}>("SELECT (COALESCE(MAX(sequence_number), 0) + 1)::text AS next_sequence_number FROM messages WHERE conversation_id = $1", [conversationId]);
    const result = await client.query<{id:string; conversation_id:string; sequence_number:string; content:string; created_at:Date}>(`
      INSERT INTO messages (conversation_id, sequence_number, role, content, safety_tier)
      VALUES ($1, $2, 'assistant', $3, $4)
      RETURNING id, conversation_id, sequence_number, content, created_at`,
      [conversationId, sequence.rows[0].next_sequence_number, validation.content, safetyTier]);
    const message = result.rows[0];
    if (!message) throw new Error("Assistant insertion returned no record.");
    await client.query("UPDATE conversations SET updated_at = NOW() WHERE id = $1", [conversationId]);
    await client.query("UPDATE assistant_generations SET status = 'completed' WHERE id = $1", [reservation.id]);
    return { id: message.id, conversationId, sequenceNumber: message.sequence_number, role: "assistant", content: message.content, createdAt: message.created_at, safetyTier };
  });
}
