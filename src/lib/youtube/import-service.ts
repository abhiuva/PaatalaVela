import "server-only";

import { availabilityToEmbedStatus, getNextSequence, type SuggestedSongMetadata, type YouTubeVideoMetadata } from "@/lib/youtube/import";
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
};

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
  const duplicateSongId = await findDuplicateSongId(supabase, input.metadata.youtubeVideoId);
  if (duplicateSongId) {
    return { status: "duplicate" as const, songId: duplicateSongId };
  }

  const singers = parseSingers(input.singers);
  if (singers.length === 0) {
    throw new Error("At least one singer is required before import.");
  }

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
    thumbnail_url: nullableText(input.metadata.thumbnailUrl),
    embed_status: availabilityToEmbedStatus(input.metadata),
    active: true,
  };

  const songResult = await supabase.from("songs").insert(songPayload).select("id").single();
  if (songResult.error || !songResult.data) {
    throw new Error(songResult.error?.code === "23505" ? "Duplicate YouTube video." : "Unable to create song.");
  }

  const songId = songResult.data.id;
  const assignmentResult = await supabase.from("channel_songs").insert({
    song_id: songId,
    channel_id: input.channelId,
    sequence: input.sequence,
    active: true,
  });

  if (assignmentResult.error) {
    await supabase.from("songs").delete().eq("id", songId);
    throw new Error("Unable to create channel assignment.");
  }

  return { status: "imported" as const, songId };
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
