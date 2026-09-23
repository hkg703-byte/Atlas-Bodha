import { randomBytes } from "node:crypto";
import { withTransaction } from "@/lib/db/transaction";
import { createSession, hashSessionToken } from "./session";
import { sendSignInEmail } from "@/server/email/emailSender";

export function appBaseUrl() {
  const url = new URL(process.env.APP_BASE_URL ?? "http://localhost:3000");
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('Invalid app base URL');
  }
  return url.origin;
}

export async function requestMagicLink(email: string, firstName: string, ip: string) {
  const linkBase = appBaseUrl();
  const token = randomBytes(32).toString('base64url');
  const allowed = await withTransaction(async (client) => {
    // Fixed lock order serializes both shared limits across all app instances.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ['atlas-link-ip:' + ip]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ['atlas-link-email:' + email]);
    const counts = await client.query<{ email_count: string; ip_count: string }>(`
      SELECT (SELECT count(*) FROM magic_link_tokens WHERE email=$1 AND created_at > NOW()-INTERVAL '15 minutes') AS email_count,
             (SELECT count(*) FROM magic_link_tokens WHERE request_ip=$2 AND created_at > NOW()-INTERVAL '1 hour') AS ip_count`, [email, ip]);
    if (Number(counts.rows[0].email_count) >= 3 || Number(counts.rows[0].ip_count) >= 10) return false;
    await client.query(`INSERT INTO magic_link_tokens(email, token_hash, request_ip, first_name, adult_attested_at)
      VALUES ($1,$2,$3,$4,NOW())`, [email, hashSessionToken(token), ip, firstName || null]);
    return true;
  });
  // Failed delivery still consumes a rate slot; retries cannot bypass the limits.
  if (allowed) await sendSignInEmail(email, `${linkBase}/auth/verify?token=${token}`);
}

type TokenRow = { id: string; email: string; first_name: string | null; adult_attested_at: Date; consumed_at: Date | null; expired: boolean };
export async function consumeMagicLink(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { error: 'invalid' } as const;
  return withTransaction(async (client) => {
    const result = await client.query<TokenRow>(`SELECT *, expires_at <= NOW() AS expired FROM magic_link_tokens WHERE token_hash=$1 FOR UPDATE`, [hashSessionToken(token)]);
    const row = result.rows[0];
    if (!row) return { error: 'invalid' } as const;
    if (row.consumed_at) return { error: 'used' } as const;
    if (row.expired) return { error: 'expired' } as const;
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ['atlas-email:' + row.email]);
    const identities = await client.query<{ user_id: string }>(`SELECT DISTINCT user_id FROM external_identities WHERE provider IN ('email','password') AND lower(subject)=$1`, [row.email]);
    if (identities.rows.length > 1) return { error: 'unavailable' } as const;
    let userId = identities.rows[0]?.user_id;
    if (!userId) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('atlas-daily-signups'))");
      const count = await client.query<{ count: string }>(`SELECT count(*) FROM users WHERE created_at >= (date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles')`);
      const configured = Number(process.env.ATLAS_DAILY_SIGNUP_LIMIT ?? 50);
      const limit = Number.isInteger(configured) && configured >= 0 ? configured : 50;
      if (Number(count.rows[0].count) >= limit) return { error: 'resting' } as const;
      const user = await client.query<{ id: string }>(`INSERT INTO users(first_name, adult_attested_at) VALUES ($1,$2) RETURNING id`, [row.first_name, row.adult_attested_at]);
      userId = user.rows[0].id;
    }
    await client.query(`UPDATE users SET first_name=COALESCE(first_name,$2), adult_attested_at=COALESCE(adult_attested_at,$3) WHERE id=$1`, [userId, row.first_name, row.adult_attested_at]);
    await client.query(`INSERT INTO external_identities(user_id,provider,subject,display_name) SELECT $1,'email',$2,$3 WHERE NOT EXISTS (SELECT 1 FROM external_identities WHERE provider='email' AND lower(subject)=$2)`, [userId, row.email, row.first_name ?? '']);
    await client.query('UPDATE magic_link_tokens SET consumed_at=NOW() WHERE id=$1', [row.id]);
    const session = await createSession(userId, client);
    return { session } as const;
  });
}
