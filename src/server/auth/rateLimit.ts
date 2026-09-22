const WINDOW_MILLISECONDS = 15 * 60 * 1_000;
const MAX_ATTEMPTS = 5;

type AttemptWindow = { count: number; resetAt: number };

const globalForRateLimit = globalThis as unknown as {
  atlasSignInAttempts?: Map<string, AttemptWindow>;
};

const attempts =
  globalForRateLimit.atlasSignInAttempts ?? new Map<string, AttemptWindow>();

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.atlasSignInAttempts = attempts;
}

export function getSignInRateLimitKey(request: Request, email: string) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  return `${ip}:${email}`;
}

export function consumeSignInAttempt(key: string) {
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MILLISECONDS });
    return true;
  }

  if (current.count >= MAX_ATTEMPTS) {
    return false;
  }

  current.count += 1;
  return true;
}

export function clearSignInAttempts(key: string) {
  attempts.delete(key);
}
