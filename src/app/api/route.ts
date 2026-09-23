import { getCurrentUser } from "@/server/auth/requireCurrentUser";
export async function GET() {
  return await getCurrentUser() ? Response.json({ ok: true }) : Response.json({ error: "Authentication required" }, { status: 401 });
}
