import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { queryDatabase } from "@/lib/db/query";
import type { UserRecord } from "@/server/repositories/userRepository";

export const SESSION_COOKIE_NAME = "atlas_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type SessionUserRow = UserRecord & { expires_at: Date };

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest();
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1_000);

  await queryDatabase(
    `
      INSERT INTO auth_sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3);
    `,
    [userId, hashSessionToken(token), expiresAt],
  );

  return { token, expiresAt };
}

export async function findUserForSessionToken(
  token: string | undefined,
): Promise<UserRecord | null> {
  if (!token) {
    return null;
  }

  const result = await queryDatabase<SessionUserRow>(
    `
      SELECT u.id, u.created_at, u.updated_at, s.expires_at
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
      LIMIT 1;
    `,
    [hashSessionToken(token)],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function revokeSession(token: string | undefined) {
  if (!token) {
    return;
  }

  await queryDatabase(
    `
      UPDATE auth_sessions
      SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE token_hash = $1;
    `,
    [hashSessionToken(token)],
  );
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getSessionTokenFromCookies() {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}
