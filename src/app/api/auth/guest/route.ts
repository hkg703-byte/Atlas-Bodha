import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db/transaction";
import { createSession, setSessionCookie } from "@/server/auth/session";

// No sign-in (Josh 2026-09-22): every visitor gets a private guest identity automatically.
// Conversations and memory are tied to this browser via the session cookie.
const GUESTS_PER_IP_PER_DAY = Number(process.env.ATLAS_GUESTS_PER_IP_PER_DAY ?? 20);
const created = new Map<string, number[]>();

function allowed(ip: string) {
  const now = Date.now();
  const recent = (created.get(ip) ?? []).filter((t) => now - t < 86_400_000);
  if (recent.length >= GUESTS_PER_IP_PER_DAY) return false;
  recent.push(now);
  created.set(ip, recent);
  return true;
}

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (!allowed(ip)) {
    return new NextResponse("Atlas is resting right now and will be back soon.", { status: 429 });
  }

  const userId = await withTransaction(async (client) => {
    const user = await client.query<{ id: string }>("INSERT INTO users DEFAULT VALUES RETURNING id;");
    await client.query(
      "INSERT INTO external_identities (user_id, provider, subject, display_name) VALUES ($1, $2, $3, $4);",
      [user.rows[0].id, "guest", randomUUID(), "Guest"],
    );
    return user.rows[0].id;
  });

  const session = await createSession(userId);
  const response = NextResponse.redirect(new URL(next, request.url));
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}
