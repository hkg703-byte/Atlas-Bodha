import { NextResponse } from "next/server";
import { queryDatabase } from "@/lib/db/query";
import { verifyPassword } from "@/server/auth/password";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { hasValidRequestOrigin } from "@/server/auth/origin";
import {
  clearSignInAttempts,
  consumeSignInAttempt,
  getSignInRateLimitKey,
} from "@/server/auth/rateLimit";

const GENERIC_ERROR = "Email or password incorrect";

type PasswordIdentity = {
  user_id: string;
  password_salt: Buffer;
  password_hash: Buffer;
};

const DUMMY_SALT = Buffer.alloc(16);
const DUMMY_HASH = Buffer.alloc(64);

function isJsonRequest(request: Request) {
  return request.headers.get("content-type")?.includes("application/json") ?? false;
}

function failureResponse(request: Request, status = 401) {
  if (isJsonRequest(request)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status });
  }

  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/sign-in?error=credentials" },
  });
}

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  let email = "";
  let password = "";
  try {
    if (isJsonRequest(request)) {
      const body = (await request.json()) as Record<string, unknown>;
      email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      password = typeof body.password === "string" ? body.password : "";
    } else {
      const formData = await request.formData();
      email = String(formData.get("email") ?? "").trim().toLowerCase();
      password = String(formData.get("password") ?? "");
    }
  } catch {
    return failureResponse(request);
  }

  if (!email || email.length > 320 || !password || password.length > 1_024) {
    return failureResponse(request);
  }

  const rateLimitKey = getSignInRateLimitKey(request, email);
  if (!consumeSignInAttempt(rateLimitKey)) {
    return failureResponse(request, 429);
  }

  try {
    const result = await queryDatabase<PasswordIdentity>(
      `
        SELECT user_id, password_salt, password_hash
        FROM external_identities
        WHERE provider = 'password' AND subject = $1
        LIMIT 1;
      `,
      [email],
    );
    const identity = result.rows[0];
    const passwordMatches = await verifyPassword(
      password,
      identity?.password_salt ?? DUMMY_SALT,
      identity?.password_hash ?? DUMMY_HASH,
    );

    if (!identity || !passwordMatches) {
      return failureResponse(request);
    }

    const session = await createSession(identity.user_id);
    clearSignInAttempts(rateLimitKey);

    const response = isJsonRequest(request)
      ? NextResponse.json({ ok: true })
      : new NextResponse(null, { status: 303, headers: { Location: "/" } });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch {
    return NextResponse.json(
      { error: "Authentication temporarily unavailable" },
      { status: 503 },
    );
  }
}
