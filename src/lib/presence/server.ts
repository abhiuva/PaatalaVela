import "server-only";

import { createHmac, createHash } from "node:crypto";
import { getServerSecretEnv } from "@/lib/env";

export function hashPresenceSession(sessionId: string) {
  const { serviceRoleKey } = getServerSecretEnv();
  if (!serviceRoleKey) throw new Error("PRESENCE_NOT_CONFIGURED");
  return createHmac("sha256", serviceRoleKey).update(sessionId).digest("hex");
}

export function presenceRequestKey(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const agent = request.headers.get("user-agent") ?? "unknown";
  return createHash("sha256").update(`${address}:${agent}`).digest("hex");
}
