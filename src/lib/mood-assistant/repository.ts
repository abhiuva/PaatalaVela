import "server-only";

import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { MoodCandidate, MoodIntent, PublicMoodIntent } from "@/lib/mood-assistant/types";

type CandidateRow = {
  song_id: string;
  assignment_id: string;
  channel_id: string;
  title: string;
  film: string;
  release_year: number;
  singers: string[];
  composer: string;
  thumbnail_url: string | null;
  song_story: string | null;
  context: string | null;
  language_code: string;
  era_code: string;
  moods: string[] | null;
  occasions: string[] | null;
  energy_code: "low" | "medium" | "high" | null;
  valence_code: "negative" | "neutral" | "positive" | null;
  regions: string[] | null;
  classification_confidence: number | null;
  classification_source: "editorial" | "admin-approved" | null;
  youtube_video_id: string;
  duration_seconds: number | null;
};

export async function fetchMoodCandidates(intent: MoodIntent): Promise<MoodCandidate[]> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) throw new Error("MOOD_CATALOGUE_NOT_CONFIGURED");
  const { data, error } = await supabase.rpc("get_mood_assistant_candidates", {
    p_languages: intent.languages,
    p_eras: intent.eras,
    p_singers: intent.singers,
    p_composers: intent.composers,
    p_require_duration: Boolean(intent.durationMinutes),
    p_limit: 300,
  }).abortSignal(AbortSignal.timeout(3_000));
  if (error || !data) {
    console.error("Mood Assistant candidate query failed", { code: error?.code ?? "NO_DATA" });
    if (error?.code === "PGRST202") throw new Error("MOOD_CATALOGUE_NOT_CONFIGURED");
    throw new Error("MOOD_CATALOGUE_QUERY_FAILED");
  }
  return (data as CandidateRow[]).map((row) => ({
    id: row.song_id,
    title: row.title,
    film: row.film,
    year: row.release_year,
    singers: row.singers,
    composer: row.composer,
    thumbnailUrl: row.thumbnail_url,
    story: row.song_story,
    context: row.context,
    languageCode: row.language_code,
    eraCode: row.era_code,
    moods: row.moods ?? [],
    occasions: row.occasions ?? [],
    energy: row.energy_code,
    valence: row.valence_code,
    regions: row.regions ?? [],
    youtubeVideoId: row.youtube_video_id,
    durationSeconds: row.duration_seconds,
    assignmentId: row.assignment_id,
    channelId: row.channel_id,
    active: true,
    embedStatus: "available",
    classificationConfidence: row.classification_confidence,
    classificationSource: row.classification_source,
  }));
}

export async function recordMoodGeneration(record: {
  id: string;
  sessionHash: string;
  intent: PublicMoodIntent;
  providerMode: "provider" | "fallback";
  resultCount: number;
  playlistDurationSeconds: number;
  totalMs: number;
  status: "generated" | "clarification" | "empty" | "failed";
}) {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return;
  const privacySafeIntent = {
    moods: record.intent.moods,
    occasions: record.intent.occasions,
    languages: record.intent.languages,
    regions: record.intent.regions,
    eras: record.intent.eras,
    energy: record.intent.energy,
    valence: record.intent.valence,
    durationMinutes: record.intent.durationMinutes,
    songCount: record.intent.songCount,
    hasSingerConstraint: record.intent.singers.length > 0,
    hasComposerConstraint: record.intent.composers.length > 0,
    exclusionCount: record.intent.exclusions.length,
  };
  const { error } = await supabase.from("mood_assistant_generations").insert({
    id: record.id,
    session_hash: record.sessionHash,
    normalized_intent: privacySafeIntent,
    provider_mode: record.providerMode,
    result_count: record.resultCount,
    playlist_duration_seconds: record.playlistDurationSeconds,
    total_ms: record.totalMs,
    status: record.status,
  });
  if (error) console.error("Mood Assistant generation metrics insert failed", { code: error.code });
}
