import "server-only";

import { availabilityToEmbedStatus, getNextSequence, type SuggestedSongMetadata, type YouTubeVideoMetadata } from "@/lib/youtube/import";
import { isUuid } from "@/lib/validation/uuid";
import type { Database, DbYouTubeImportQueue } from "@/types/database";

type SupabaseService = ReturnType<typeof import("@/lib/supabase/server").createServiceSupabaseClient>;

export type ImportSongInput = {
  metadata: YouTubeVideoMetadata;
  channelId: string;
  sequence: number;
  title: string;
  teluguTitle?: string | null;
  film: string;
  releaseYear: number;
  singers: string;
  composer: string;
  lyricist?: string | null;
  editorialNote?: string | null;
  languageCode: string;
  eraCode: string;
  moodCodes?: string[];
  occasionCodes?: string[];
  songStory?: string | null;
  context?: string | null;
  actorId?: string | null;
};

export type ImportStage = "validation" | "permission" | "song_insert" | "channel_assignment" | "sequence_conflict" | "transaction";

export class ImportStageError extends Error {
  constructor(public readonly stage: ImportStage, public readonly safeCode: string, message: string) {
    super(message);
    this.name = "ImportStageError";
  }
}

type AtomicImportResult = {
  status: "imported" | "assigned_existing" | "already_assigned" | "reactivated";
  song_id: string;
  assignment_id: string;
  sequence: number;
};

function importRpcError(error: { code?: string; message?: string }) {
  if (error.code === "42501") return new ImportStageError("permission", "ADMIN_IMPORT_PERMISSION_DENIED", "Permission denied while importing the song.");
  if (error.code === "23505") return new ImportStageError("sequence_conflict", "ADMIN_IMPORT_SEQUENCE_CONFLICT", "The channel order changed during import. Retry the import.");
  if (error.code === "23503" && /mood|occasion|taxonomy/i.test(error.message ?? "")) {
    return new ImportStageError("validation", "ADMIN_IMPORT_TAXONOMY_INVALID", "A selected taxonomy value is unavailable. Review the mood and occasion fields.");
  }
  if (error.code === "23503" || error.code === "P0002") return new ImportStageError("channel_assignment", "ADMIN_IMPORT_CHANNEL_INVALID", "The selected channel is unavailable.");
  if (error.code === "22023" || error.code === "23514" || /language|taxonomy/i.test(error.message ?? "")) {
    return new ImportStageError("validation", "ADMIN_IMPORT_DATABASE_VALIDATION", "Song or taxonomy data failed database validation.");
  }
  return new ImportStageError("transaction", "ADMIN_IMPORT_TRANSACTION_FAILED", "The song import transaction failed and no partial record was kept.");
}

export function nullableText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

export function parseSingers(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function nextSequenceForChannel(supabase: SupabaseService, channelId: string) {
  if (!supabase) throw new Error("Supabase service client is unavailable.");
  const { data, error } = await supabase.from("channel_songs").select("sequence,active").eq("channel_id", channelId);
  if (error) throw new Error("Unable to calculate next sequence.");
  return getNextSequence(data ?? []);
}

export async function findDuplicateSongId(supabase: SupabaseService, youtubeVideoId: string) {
  if (!supabase) throw new Error("Supabase service client is unavailable.");
  const { data } = await supabase.from("songs").select("id").eq("youtube_video_id", youtubeVideoId).maybeSingle();
  return data?.id ?? null;
}

export async function createSongWithAssignment(supabase: SupabaseService, input: ImportSongInput) {
  if (!supabase) throw new Error("Supabase service client is unavailable.");
  const singers = parseSingers(input.singers);
  if (!isUuid(input.channelId)) throw new ImportStageError("validation", "ADMIN_IMPORT_CHANNEL_UUID_INVALID", "Choose a valid catalogue channel.");
  if (!Number.isInteger(input.sequence) || input.sequence < 1) throw new ImportStageError("validation", "ADMIN_IMPORT_SEQUENCE_INVALID", "Sequence must be a positive whole number.");
  if (!input.title.trim()) throw new ImportStageError("validation", "ADMIN_IMPORT_TITLE_REQUIRED", "Song title is required.");
  if (!input.film.trim()) throw new ImportStageError("validation", "ADMIN_IMPORT_FILM_REQUIRED", "Film or album is required.");
  if (!input.composer.trim()) throw new ImportStageError("validation", "ADMIN_IMPORT_COMPOSER_REQUIRED", "Composer is required.");
  if (singers.length === 0) throw new ImportStageError("validation", "ADMIN_IMPORT_SINGERS_REQUIRED", "At least one singer is required.");
  if (!Number.isInteger(input.releaseYear) || input.releaseYear < 1900 || input.releaseYear > 2100) throw new ImportStageError("validation", "ADMIN_IMPORT_RELEASE_YEAR_INVALID", "Release year must be between 1900 and 2100.");

  const songPayload: Database["public"]["Tables"]["songs"]["Insert"] = {
    title: input.title.trim(),
    telugu_title: nullableText(input.teluguTitle),
    film: input.film.trim(),
    release_year: input.releaseYear,
    singers,
    composer: input.composer.trim(),
    lyricist: nullableText(input.lyricist),
    youtube_video_id: input.metadata.youtubeVideoId,
    youtube_url: input.metadata.youtubeUrl,
    duration_seconds: input.metadata.durationSeconds,
    spotify_url: null,
    youtube_music_url: null,
    editorial_note: nullableText(input.editorialNote ?? input.metadata.description),
    editorial_note_telugu: null,
    language_code: input.languageCode,
    era_code: input.eraCode,
    song_story: nullableText(input.songStory),
    context: nullableText(input.context),
    thumbnail_url: nullableText(input.metadata.thumbnailUrl),
    embed_status: availabilityToEmbedStatus(input.metadata),
    active: true,
  };

  const { data, error } = await supabase.rpc("import_song_with_assignment_atomic", {
    p_channel_id: input.channelId,
    p_song: songPayload as Record<string, unknown>,
    p_requested_sequence: input.sequence,
    p_mood_codes: input.moodCodes ?? [],
    p_occasion_codes: input.occasionCodes ?? [],
    p_actor_id: input.actorId ?? null,
  });
  if (error) throw importRpcError(error);
  const result = data as AtomicImportResult | null;
  if (!result?.song_id || !result.assignment_id || !Number.isInteger(result.sequence)) {
    throw new ImportStageError("transaction", "ADMIN_IMPORT_RESPONSE_INVALID", "The import completed without a valid assignment response.");
  }
  return { status: result.status, songId: result.song_id, assignmentId: result.assignment_id, sequence: result.sequence };
}

export function suggestedMetadataFromQueue(item: DbYouTubeImportQueue): SuggestedSongMetadata {
  const metadata = item.suggested_metadata as Partial<SuggestedSongMetadata>;
  return {
    title: String(metadata.title ?? item.source_title ?? ""),
    teluguTitle: String(metadata.teluguTitle ?? ""),
    film: String(metadata.film ?? ""),
    singers: String(metadata.singers ?? ""),
    composer: String(metadata.composer ?? ""),
    lyricist: String(metadata.lyricist ?? ""),
    releaseYear: String(metadata.releaseYear ?? ""),
  };
}
