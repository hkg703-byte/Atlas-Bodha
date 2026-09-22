import { getSessionTokenFromCookies, findUserForSessionToken } from "./session";
import type { UserRecord } from "@/server/repositories/userRepository";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export async function getCurrentUser(): Promise<UserRecord | null> {
  const token = await getSessionTokenFromCookies();
  return findUserForSessionToken(token);
}

export async function requireCurrentUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthenticationRequiredError();
  }

  return user;
}
