import { withTransaction } from "@/lib/db/transaction";
import { queryDatabase } from "@/lib/db/query";

export const RESTING_MESSAGE = "Atlas is resting right now and will be back soon.";
export const LIMIT_MESSAGE = "You've reached today's reply limit. Atlas will be here when more replies become available.";
export type GenerationReservation = { id: string; personMessageId: string };
export type ReservationResult =
  | { state: "reserved"; reservation: GenerationReservation }
  | { state: "missing" | "complete" | "busy" | "limit" | "resting" };

function nonnegativeInteger(value: string | undefined, fallback: number): number {
  const configured = Number(value ?? fallback);
  return Number.isInteger(configured) && configured >= 0 ? configured : fallback;
}

// Short transaction only. External generation never holds a DB transaction open.
export async function reserveAssistantGeneration(userId: string, conversationId: string, kind: "reply" | "preview" = "reply"): Promise<ReservationResult> {
  return withTransaction(async client => {
    // Serialize usage reservations across conversations and application instances.
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    // Serialize the global count and insert across all users and app instances.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('atlas:global-daily-reply-limit'))");
    const conversation = await client.query("SELECT id FROM conversations WHERE id = $1 AND user_id = $2 FOR UPDATE", [conversationId, userId]);
    if (!conversation.rowCount) return { state: "missing" };
    await client.query("UPDATE assistant_generations SET status = 'failed' WHERE user_id = $1 AND status = 'pending' AND expires_at <= NOW()", [userId]);
    const latest = await client.query<{id:string; role:string}>("SELECT id, role FROM messages WHERE conversation_id = $1 ORDER BY sequence_number DESC LIMIT 1", [conversationId]);
    if (!latest.rows[0] || latest.rows[0].role !== "person") return { state: "complete" };
    const active = await client.query("SELECT id FROM assistant_generations WHERE conversation_id = $1 AND status = 'pending'", [conversationId]);
    if (active.rowCount) return { state: "busy" };
    const count = await client.query<{count:string}>(`
      SELECT (
        (SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id
          WHERE c.user_id = $1 AND m.role = 'assistant' AND m.created_at > NOW() - INTERVAL '24 hours') +
        (SELECT COUNT(*) FROM assistant_generations WHERE user_id = $1 AND
          (status = 'pending' OR (kind = 'preview' AND status = 'completed' AND created_at > NOW() - INTERVAL '24 hours')))
      )::text AS count`, [userId]);
    const limit = nonnegativeInteger(process.env.ATLAS_DAILY_REPLY_LIMIT, 60);
    if (Number(count.rows[0].count) >= limit) return { state: "limit" };
    const globalCount = await client.query<{count:string}>(`
      SELECT (
        (SELECT COUNT(*) FROM messages
          WHERE role = 'assistant'
            AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles') +
        (SELECT COUNT(*) FROM assistant_generations WHERE
          (status = 'pending' AND expires_at > NOW()) OR
          (kind = 'preview' AND status = 'completed' AND
            created_at >= date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles'))
      )::text AS count`);
    const globalLimit = nonnegativeInteger(process.env.ATLAS_GLOBAL_DAILY_REPLY_LIMIT, 400);
    if (Number(globalCount.rows[0].count) >= globalLimit) return { state: "resting" };
    const inserted = await client.query<{id:string}>("INSERT INTO assistant_generations (user_id, conversation_id, person_message_id, kind) VALUES ($1,$2,$3,$4) RETURNING id", [userId, conversationId, latest.rows[0].id, kind]);
    return { state: "reserved", reservation: { id: inserted.rows[0].id, personMessageId: latest.rows[0].id } };
  });
}

export async function finishGeneration(id: string, status: "completed" | "failed") {
  await queryDatabase("UPDATE assistant_generations SET status = $2 WHERE id = $1 AND status = 'pending'", [id, status]);
}
