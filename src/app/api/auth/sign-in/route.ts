import { NextResponse } from "next/server";
import { hasValidRequestOrigin } from "@/server/auth/origin";
import { requestMagicLink } from "@/server/auth/magicLink";

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  const json = request.headers.get('content-type')?.includes('application/json');
  try {
    const body = json ? await request.json() : Object.fromEntries(await request.formData());
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.firstName === 'string' ? body.firstName.trim().slice(0,100) : '';
    const adult = body.adult === true || body.adult === 'on';
    if (adult && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      // Set only by a trusted ingress that overwrites this header; otherwise all
      // requests share one conservative bucket. Never trust client-supplied XFF.
      const ip = process.env.TRUST_PROXY_IP === 'true'
        ? (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0,128) || 'unknown')
        : 'unknown';
      await requestMagicLink(email, name, ip);
    }
  } catch {
    // Identical response for invalid input, throttling and delivery failures.
    // Never log provider errors or request data: they may contain credentials.
  }
  return json ? NextResponse.json({ message: 'Check your email for a sign-in link' })
    : new NextResponse(null, { status: 303, headers: { Location: '/sign-in?sent=1' } });
}
