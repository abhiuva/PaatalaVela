import type { DbAdminProfile } from "@/types/database";

export const GENERIC_LOGIN_ERROR = "Unable to sign in with those credentials.";

export function isActiveAdministrator<T extends Pick<DbAdminProfile, "role" | "active">>(profile: T | null | undefined): profile is T & { role: "admin"; active: true } {
  return profile?.role === "admin" && profile.active === true;
}

export function adminAccessState(hasValidUser: boolean, profile: Pick<DbAdminProfile, "role" | "active"> | null | undefined) {
  if (!hasValidUser) return "unauthenticated" as const;
  return isActiveAdministrator(profile) ? "authorized" as const : "unauthorized" as const;
}
