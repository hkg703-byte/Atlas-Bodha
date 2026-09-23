import { NextResponse } from "next/server";
import { consumeMagicLink } from "@/server/auth/magicLink";
import { setSessionCookie } from "@/server/auth/session";

export async function GET(request: Request) {
  let destination = '/sign-in?error=unavailable';
  try {
    const result = await consumeMagicLink(new URL(request.url).searchParams.get('token') ?? '');
    if ('session' in result && result.session) {
      const response = new NextResponse(null, { status: 303, headers: { Location: '/', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
      setSessionCookie(response, result.session.token, result.session.expiresAt);
      return response;
    }
    destination = '/sign-in?error=' + result.error;
  } catch { /* No request URLs, tokens or provider errors in logs. */ }
  return new NextResponse(null, { status: 303, headers: { Location: destination, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
