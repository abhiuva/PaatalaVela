import { z } from "zod";
import type { AnalyticsEventName } from "@/types/database";

export const analyticsEventNames = [
  "radio_session_started",
  "radio_session_ended",
  "radio_paused",
  "song_started",
  "song_completed",
  "song_skipped",
  "player_error",
  "channel_changed",
  "manual_mode_started",
  "returned_to_live",
  "scheduled_channel_transitioned",
  "playback_resynchronised",
  "fallback_catalogue_used",
  "whatsapp_share_clicked",
  "youtube_source_clicked",
  "schedule_viewed",
  "song_request_started",
  "song_request_submitted",
  "sponsor_impression",
  "sponsor_clicked",
  "takedown_form_opened",
  "channel_impression",
  "channel_selected",
  "listening_duration_recorded",
  "shuffle_mode_changed",
] as const satisfies readonly AnalyticsEventName[];

const safeId = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/);
const playbackMode = z.enum(["live", "manual"]);
const deviceCategory = z.enum(["mobile", "tablet", "desktop"]);

const base = z.object({
  session_id: safeId,
  language_code: z.string().trim().min(2).max(8).optional(),
  channel_mode: z.enum(["scheduled", "on_demand"]).optional(),
});

export const eventSchemas = {
  radio_session_started: base.extend({
    playback_mode: playbackMode,
    channel_id: safeId,
    scheduled_channel_id: safeId,
    source: z.enum(["supabase", "local"]),
    device_category: deviceCategory,
  }),
  radio_session_ended: base.extend({
    listening_seconds: z.coerce.number().int().min(0).max(24 * 60 * 60),
    songs_started: z.coerce.number().int().min(0).max(500),
    songs_completed: z.coerce.number().int().min(0).max(500),
    channel_id: safeId,
  }),
  radio_paused: base.extend({ channel_id: safeId, listened_seconds: z.coerce.number().min(0).max(24 * 60 * 60) }),
  song_started: base.extend({
    song_id: safeId,
    channel_id: safeId,
    playback_mode: playbackMode,
    sequence: z.coerce.number().int().min(0).max(10000),
    started_from_seconds: z.coerce.number().min(0).max(24 * 60 * 60),
  }),
  song_completed: base.extend({
    song_id: safeId,
    channel_id: safeId,
    listened_seconds: z.coerce.number().min(0).max(24 * 60 * 60),
    completion_percent: z.coerce.number().min(0).max(100),
  }),
  song_skipped: base.extend({
    song_id: safeId,
    channel_id: safeId,
    reason: z.enum(["next", "player_error", "manual_channel_change", "return_to_live"]),
    listened_seconds: z.coerce.number().min(0).max(24 * 60 * 60),
  }),
  player_error: base.extend({
    song_id: safeId,
    channel_id: safeId,
    youtube_error_category: z.enum(["invalid_parameter", "html5_error", "not_found", "embedding_disabled", "unknown"]),
    recovery_success: z.boolean(),
  }),
  channel_changed: base.extend({
    previous_channel_id: safeId,
    selected_channel_id: safeId,
    reason: z.enum(["manual", "schedule", "fallback"]),
    playback_mode: playbackMode,
  }),
  manual_mode_started: base.extend({ channel_id: safeId }),
  returned_to_live: base.extend({ channel_id: safeId }),
  scheduled_channel_transitioned: base.extend({ previous_channel_id: safeId, selected_channel_id: safeId }),
  playback_resynchronised: base.extend({ channel_id: safeId, drift_seconds: z.coerce.number().min(0).max(3600) }),
  fallback_catalogue_used: base.extend({ reason: z.string().trim().max(160) }),
  whatsapp_share_clicked: base.extend({ song_id: safeId, channel_id: safeId }),
  youtube_source_clicked: base.extend({ song_id: safeId, channel_id: safeId }),
  schedule_viewed: base.extend({ channel_id: safeId.optional() }),
  song_request_started: base.extend({ requested_channel_id: safeId.optional() }),
  song_request_submitted: base.extend({ requested_channel_id: safeId }),
  sponsor_impression: base.extend({ campaign_id: safeId, placement_type: z.string().trim().max(40) }),
  sponsor_clicked: base.extend({ campaign_id: safeId, placement_type: z.string().trim().max(40) }),
  takedown_form_opened: base,
  channel_impression: base.extend({ channel_id: safeId, position: z.coerce.number().int().min(1).max(100) }),
  channel_selected: base.extend({ channel_id: safeId, previous_channel_id: safeId.optional() }),
  listening_duration_recorded: base.extend({
    channel_id: safeId,
    song_id: safeId.optional(),
    listening_seconds: z.coerce.number().int().min(0).max(24 * 60 * 60),
  }),
  shuffle_mode_changed: base.extend({
    channel_id: safeId,
    channel_slug: safeId,
    previous_mode: z.enum(["normal", "shuffle"]),
    new_mode: z.enum(["normal", "shuffle"]),
  }),
} satisfies Record<AnalyticsEventName, z.ZodType>;

const blockedPersonalFields = ["email", "claimant", "claimant_email", "name", "song_title", "singer", "youtube_url", "user_agent", "supabase_user_id"];

export function validateAnalyticsEvent(eventName: string, properties: unknown) {
  if (!analyticsEventNames.includes(eventName as AnalyticsEventName)) {
    return { ok: false as const, message: "Unsupported analytics event." };
  }

  const serialized = JSON.stringify(properties ?? {});
  if (serialized.length > 3000) {
    return { ok: false as const, message: "Analytics payload is too large." };
  }

  if (properties && typeof properties === "object") {
    for (const key of Object.keys(properties)) {
      if (blockedPersonalFields.includes(key.toLowerCase())) {
        return { ok: false as const, message: "Analytics payload contains unsupported personal data." };
      }
    }
  }

  const schema = eventSchemas[eventName as AnalyticsEventName];
  const parsed = schema.safeParse(properties);
  if (!parsed.success) {
    return { ok: false as const, message: "Analytics payload failed validation." };
  }

  return { ok: true as const, eventName: eventName as AnalyticsEventName, properties: parsed.data as Record<string, unknown> };
}

export function completionRate(songsCompleted: number, songsStarted: number) {
  if (songsStarted <= 0) {
    return 0;
  }
  return songsCompleted / songsStarted;
}
