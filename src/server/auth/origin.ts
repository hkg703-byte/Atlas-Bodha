export function hasValidRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  // Next may expose its internal listen address through request.url. Browsers
  // cannot override Host, so compare against the actual requested authority.
  const host = request.headers.get("host");
  if (!host) {
    return false;
  }

  try {
    const source = new URL(origin);
    return (
      (source.protocol === "http:" || source.protocol === "https:") &&
      source.host === host
    );
  } catch {
    return false;
  }
}
