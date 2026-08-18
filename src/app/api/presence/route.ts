import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { resolveChannelReference } from "@/lib/analytics/channel-reference";
import { consumeRateLimit } from "@/lib/feedback/rate-limit";
import { hashPresenceSession, presenceRequestKey } from "@/lib/presence/server";
import { isLikelyBot, presenceInputSchema } from "@/lib/presence/validation";

const rateLimit = new Map<string, { count: number; resetAt: number }>();

async function resolveChannelId(supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>, reference: string) {
  return resolveChannelReference(reference, async (slug) => {
    const { data } = await supabase.from("channels").select("id").eq("slug", slug).eq("active", true).maybeSingle();
    return data?.id ?? null;
  });
}

export async function POST(request: Request) {
  if (consumeRateLimit(rateLimit, presenceRequestKey(request), Date.now(), 30, 5 * 60_000)) {
    return NextResponse.json({ ok: false, code: "PRESENCE_RATE_LIMITED" }, { status: 429 });
  }
  if (isLikelyBot(request.headers.get("user-agent") ?? "")) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ ok: false, code: "PRESENCE_INVALID_JSON" }, { status: 400 }); }
  const parsed = presenceInputSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, code: "PRESENCE_INVALID_INPUT" }, { status: 400 });
  const supabase = createServiceSupabaseClient();
  if (!supabase) return NextResponse.json({ ok: false, code: "PRESENCE_UNAVAILABLE" }, { status: 503 });
  const channelId = await resolveChannelId(supabase, parsed.data.channelId);
  if (!channelId) return NextResponse.json({ ok: false, code: "PRESENCE_CHANNEL_INVALID" }, { status: 400 });
  const now = Date.now();
  const expiresAt = new Date(parsed.data.playerState === "playing" ? now + 90_000 : now).toISOString();
  const { error } = await supabase.rpc("upsert_listener_presence", {
    p_session_hash: hashPresenceSession(parsed.data.sessionId),
    p_channel_id: channelId,
    p_song_id: parsed.data.songId,
    p_player_state: parsed.data.playerState,
    p_expires_at: expiresAt,
    p_is_test: false,
  });
  if (error) {
    console.error("Presence update failed", { code: error.code });
    return NextResponse.json({ ok: false, code: "PRESENCE_UPDATE_FAILED" }, { status: 503 });
  }
  await supabase.rpc("delete_expired_listener_sessions", {});
  return NextResponse.json({ ok: true });
}
