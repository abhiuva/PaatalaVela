import { getOrCreateSessionId, trackEvent } from "@/lib/analytics/client";
import { isUuid } from "@/lib/validation/uuid";
import type { AnalyticsEventName } from "@/types/database";

const eventMap: Record<string, AnalyticsEventName> = {
  radio_started: "radio_session_started",
  radio_paused: "radio_paused",
  live_position_calculated: "playback_resynchronised",
  song_started: "song_started",
  song_completed: "song_completed",
  song_skipped: "song_skipped",
  player_error: "player_error",
  channel_changed: "channel_changed",
  manual_mode_started: "manual_mode_started",
  returned_to_live: "returned_to_live",
  playback_resynchronised: "playback_resynchronised",
  fallback_catalogue_used: "fallback_catalogue_used",
  channel_impression: "channel_impression",
  channel_selected: "channel_selected",
  listening_duration_recorded: "listening_duration_recorded",
  shuffle_mode_changed: "shuffle_mode_changed",
};

export function trackRadioEvent(event: keyof typeof eventMap, properties: Record<string, string | number | boolean | null> = {}) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const channelReferences = Object.entries(properties).filter(([key]) => key.endsWith("channel_id"));
  if (channelReferences.some(([, value]) => !isUuid(value))) {
    return;
  }

  try {
    trackEvent(eventMap[event], {
      session_id: getOrCreateSessionId(),
      ...properties,
    });
  } catch {
    // Analytics must never affect playback.
  }
}
