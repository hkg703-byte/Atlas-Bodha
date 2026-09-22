import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  findUserForSessionToken,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";

export async function proxy(request: NextRequest) {
  const publicPaths = new Set([
    "/favicon.ico",
    "/file.svg",
    "/globe.svg",
    "/next.svg",
    "/vercel.svg",
    "/window.svg",
  ]);
  if (publicPaths.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  let user;
  try {
    user = await findUserForSessionToken(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
  } catch {
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }

  if (user) {
    return NextResponse.next();
  }

  if ((request.nextUrl.pathname === "/api" || request.nextUrl.pathname.startsWith("/api/"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signInUrl = new URL("/sign-in", request.url);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/((?!sign-in$|api/auth/sign-in$|_next/static|_next/image).*)",
  ],
};
