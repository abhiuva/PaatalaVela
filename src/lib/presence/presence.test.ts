import { describe, expect, it } from "vitest";
import { aggregateActiveListeners, isLikelyBot, presenceInputSchema } from "@/lib/presence/validation";

const now = Date.parse("2026-08-18T12:00:00Z");
const row = (changes = {}) => ({ channel_id: "channel-1", player_state: "playing" as const, last_seen_at: "2026-08-18T11:59:30Z", expires_at: "2026-08-18T12:01:00Z", is_test: false, ...changes });

describe("active listener definition", () => {
  it("counts only recent, unexpired, non-test playing sessions", () => {
    const rows = [row(), row({ player_state: "paused" }), row({ last_seen_at: "2026-08-18T11:58:00Z" }), row({ expires_at: "2026-08-18T11:59:59Z" }), row({ is_test: true })];
    expect(aggregateActiveListeners(rows, "channel-1", now)).toEqual({ total: 1, channel: 1 });
  });

  it("returns aggregate totals without listener identifiers", () => {
    const result = aggregateActiveListeners([row(), row({ channel_id: "channel-2" })], "channel-1", now);
    expect(result).toEqual({ total: 2, channel: 1 });
    expect(result).not.toHaveProperty("sessions");
  });

  it("strictly validates random browser IDs and allowed states", () => {
    const valid = { sessionId: "b4d625f7-4104-4f00-949f-429e4e9c4d12", channelId: "tea-shop-classics", songId: null, playerState: "playing" };
    expect(presenceInputSchema.safeParse(valid).success).toBe(true);
    expect(presenceInputSchema.safeParse({ ...valid, sessionId: "shared-name" }).success).toBe(false);
    expect(presenceInputSchema.safeParse({ ...valid, playerState: "buffering" }).success).toBe(false);
  });

  it("reasonably detects common automated user agents", () => {
    expect(isLikelyBot("Googlebot/2.1")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 Chrome/126 Safari/537.36")).toBe(false);
  });
});
