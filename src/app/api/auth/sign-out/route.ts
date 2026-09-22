import { NextResponse } from "next/server";
import { hasValidRequestOrigin } from "@/server/auth/origin";
import {
  clearSessionCookie,
  getSessionTokenFromCookies,
  revokeSession,
} from "@/server/auth/session";

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  try {
    await revokeSession(await getSessionTokenFromCookies());
    const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/sign-in" },
  });
    clearSessionCookie(response);
    return response;
  } catch {
    return NextResponse.json(
      { error: "Sign out temporarily unavailable" },
      { status: 503 },
    );
  }
}
