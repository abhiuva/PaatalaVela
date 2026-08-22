import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { validateAnalyticsEvent } from "@/lib/analytics/events";
import { resolveChannelReference } from "@/lib/analytics/channel-reference";
import { indiaDateKey } from "@/lib/presence/config";

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const bucket = rateLimit.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 60;
}

function maybeUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

async function resolveChannelId(supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>, value: unknown) {
  return resolveChannelReference(value, async (slug) => {
    const { data } = await supabase.from("channels").select("id").eq("slug", slug).eq("active", true).maybeSingle();
    return data?.id ?? null;
  });
}

async function incrementChannelMetric(
  supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>,
  metricDate: string,
  channelId: string | null,
  increments: Partial<{
    listening_sessions: number;
    unique_anonymous_sessions: number;
    songs_started: number;
    songs_completed: number;
    listening_seconds: number;
    skips: number;
    player_errors: number;
    shares: number;
    fallback_catalogue_uses: number;
  }>,
) {
  if (!channelId) {
    return;
  }
  const { data: existing } = await supabase
    .from("daily_channel_metrics")
    .select("*")
    .eq("metric_date_ist", metricDate)
    .eq("channel_id", channelId)
    .maybeSingle();

  await supabase.from("daily_channel_metrics").upsert({
    metric_date_ist: metricDate,
    channel_id: channelId,
    listening_sessions: (existing?.listening_sessions ?? 0) + (increments.listening_sessions ?? 0),
    unique_anonymous_sessions: (existing?.unique_anonymous_sessions ?? 0) + (increments.unique_anonymous_sessions ?? 0),
    songs_started: (existing?.songs_started ?? 0) + (increments.songs_started ?? 0),
    songs_completed: (existing?.songs_completed ?? 0) + (increments.songs_completed ?? 0),
    listening_seconds: (existing?.listening_seconds ?? 0) + (increments.listening_seconds ?? 0),
    skips: (existing?.skips ?? 0) + (increments.skips ?? 0),
    player_errors: (existing?.player_errors ?? 0) + (increments.player_errors ?? 0),
    shares: (existing?.shares ?? 0) + (increments.shares ?? 0),
    fallback_catalogue_uses: (existing?.fallback_catalogue_uses ?? 0) + (increments.fallback_catalogue_uses ?? 0),
    updated_at: new Date().toISOString(),
  });
}

async function incrementSponsorMetric(
  supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>,
  metricDate: string,
  campaignId: string | null,
  increment: "impressions" | "clicks",
) {
  if (!campaignId) {
    return;
  }
  const { data: existing } = await supabase
    .from("daily_sponsor_metrics")
    .select("*")
    .eq("metric_date_ist", metricDate)
    .eq("campaign_id", campaignId)
    .maybeSingle();

  await supabase.from("daily_sponsor_metrics").upsert({
    metric_date_ist: metricDate,
    campaign_id: campaignId,
    impressions: (existing?.impressions ?? 0) + (increment === "impressions" ? 1 : 0),
    clicks: (existing?.clicks ?? 0) + (increment === "clicks" ? 1 : 0),
    updated_at: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  if (isRateLimited(getClientKey(request))) {
    return NextResponse.json({ ok: false, message: "Too many analytics events." }, { status: 429 });
  }

  let body: { eventName?: string; properties?: unknown };
  try {
    body = (await request.json()) as { eventName?: string; properties?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid analytics payload." }, { status: 400 });
  }

  const validated = validateAnalyticsEvent(String(body.eventName ?? ""), body.properties);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, message: validated.message }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, stored: false });
  }

  const properties = validated.properties;
  const metricDate = indiaDateKey();
  const channelId = await resolveChannelId(supabase, properties.channel_id);
  const songId = maybeUuid(properties.song_id);
  const { error } = await supabase.from("listening_events").insert({
    anonymous_session_id: String(properties.session_id ?? "session_unknown"),
    event_name: validated.eventName,
    channel_id: channelId,
    song_id: songId,
    playback_mode: properties.playback_mode === "live" || properties.playback_mode === "manual" ? properties.playback_mode : null,
    properties,
    event_date_ist: metricDate,
  });

  if (!error) {
    if (validated.eventName === "radio_session_started") {
      await incrementChannelMetric(supabase, metricDate, channelId, { listening_sessions: 1, unique_anonymous_sessions: 1 });
    } else if (validated.eventName === "song_started") {
      await incrementChannelMetric(supabase, metricDate, channelId, { songs_started: 1 });
    } else if (validated.eventName === "song_completed") {
      await incrementChannelMetric(supabase, metricDate, channelId, {
        songs_completed: 1,
        listening_seconds: Number(properties.listened_seconds ?? 0),
      });
    } else if (validated.eventName === "song_skipped") {
      await incrementChannelMetric(supabase, metricDate, channelId, { skips: 1 });
    } else if (validated.eventName === "player_error") {
      await incrementChannelMetric(supabase, metricDate, channelId, { player_errors: 1 });
    } else if (validated.eventName === "whatsapp_share_clicked") {
      await incrementChannelMetric(supabase, metricDate, channelId, { shares: 1 });
    } else if (validated.eventName === "fallback_catalogue_used") {
      await incrementChannelMetric(supabase, metricDate, channelId, { fallback_catalogue_uses: 1 });
    } else if (validated.eventName === "sponsor_impression") {
      await incrementSponsorMetric(supabase, metricDate, maybeUuid(properties.campaign_id), "impressions");
    } else if (validated.eventName === "sponsor_clicked") {
      await incrementSponsorMetric(supabase, metricDate, maybeUuid(properties.campaign_id), "clicks");
    }
  }

  return NextResponse.json({ ok: !error, stored: !error }, { status: error ? 500 : 200 });
}
