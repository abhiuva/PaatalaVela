import { z } from "zod";
import { presenceConfig } from "@/lib/presence/config";

const channelReference = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9-]+$/);
const optionalUuid = z.union([z.string().uuid(), z.literal("")]).nullish().transform((value) => value || null);

export const presenceInputSchema = z.object({
  sessionId: z.string().uuid(),
  channelSlug: channelReference,
  songId: optionalUuid,
  playerState: z.enum(["playing", "paused", "stopped"]),
});

export const presenceChannelSchema = channelReference.optional();

export function isLikelyBot(userAgent: string) {
  return /bot|crawler|spider|headless|preview|slurp|facebookexternalhit|whatsapp/i.test(userAgent);
}

export type ActivePresenceRow = {
  channel_id: string | null;
  player_state: "playing" | "paused" | "stopped";
  last_seen_at: string;
  expires_at: string;
  is_test: boolean;
};

export function aggregateActiveListeners(rows: ActivePresenceRow[], channelId: string | null, now = Date.now()) {
  const cutoff = now - presenceConfig.sessionTimeoutMs;
  const active = rows.filter((row) => row.player_state === "playing" && !row.is_test && new Date(row.last_seen_at).getTime() >= cutoff && new Date(row.expires_at).getTime() > now);
  return { total: active.length, channel: channelId ? active.filter((row) => row.channel_id === channelId).length : null };
}
