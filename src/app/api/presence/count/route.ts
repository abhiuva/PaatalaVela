import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { resolveChannelReference } from "@/lib/analytics/channel-reference";
import { consumeRateLimit } from "@/lib/feedback/rate-limit";
import { presenceRequestKey } from "@/lib/presence/server";
import { aggregateActiveListeners, presenceChannelSchema } from "@/lib/presence/validation";

const rateLimit = new Map<string, { count: number; resetAt: number }>();

export async function GET(request: NextRequest) {
  if (consumeRateLimit(rateLimit, presenceRequestKey(request), Date.now(), 120, 5 * 60_000)) {
    return NextResponse.json({ ok: false, code: "PRESENCE_COUNT_RATE_LIMITED" }, { status: 429 });
  }
  const parsedChannel = presenceChannelSchema.safeParse(request.nextUrl.searchParams.get("channel") ?? undefined);
  if (!parsedChannel.success) return NextResponse.json({ ok: false, code: "PRESENCE_CHANNEL_INVALID" }, { status: 400 });
  const supabase = createServiceSupabaseClient();
  if (!supabase) return NextResponse.json({ ok: false, code: "PRESENCE_UNAVAILABLE" }, { status: 503 });
  const channelId = parsedChannel.data ? await resolveChannelReference(parsedChannel.data, async (slug) => {
    const { data } = await supabase.from("channels").select("id").eq("slug", slug).eq("active", true).maybeSingle();
    return data?.id ?? null;
  }) : null;
  if (parsedChannel.data && !channelId) return NextResponse.json({ ok: false, code: "PRESENCE_CHANNEL_INVALID" }, { status: 400 });
  const now = new Date();
  const { data, error } = await supabase.from("active_listener_sessions")
    .select("channel_id, player_state, last_seen_at, expires_at, is_test")
    .eq("player_state", "playing")
    .eq("is_test", false)
    .gte("last_seen_at", new Date(now.getTime() - 90_000).toISOString())
    .gt("expires_at", now.toISOString());
  if (error) return NextResponse.json({ ok: false, code: "PRESENCE_COUNT_UNAVAILABLE" }, { status: 503 });
  const counts = aggregateActiveListeners(data ?? [], channelId, now.getTime());
  await supabase.rpc("delete_expired_listener_sessions", {});
  return NextResponse.json({ ok: true, total: counts.total, channel: counts.channel }, { headers: { "cache-control": "no-store" } });
}
