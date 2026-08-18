import { extractYouTubeVideoId, youtubeVideoIdSchema } from "@/lib/catalogue/validation";
import type { EmbedStatus, YouTubeImportStatus } from "@/types/database";

export type YouTubeAvailability = "available" | "unavailable" | "private" | "deleted" | "embedding_disabled";

export type YouTubeVideoMetadata = {
  youtubeVideoId: string;
  youtubeUrl: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  uploader: string;
  publishedAt: string | null;
  availability: YouTubeAvailability;
  embeddable: boolean;
  suggestions: SuggestedSongMetadata;
};

export type SuggestedSongMetadata = {
  title: string;
  teluguTitle: string;
  film: string;
  singers: string;
  composer: string;
  lyricist: string;
  releaseYear: string;
};

export type YouTubeVideoApiItem = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  contentDetails?: {
    duration?: string;
  };
  status?: {
    embeddable?: boolean;
    privacyStatus?: string;
    uploadStatus?: string;
  };
};

type YouTubeThumbnailMap = NonNullable<NonNullable<YouTubeVideoApiItem["snippet"]>["thumbnails"]>;

export function parseYouTubeVideoInput(input: string) {
  return extractYouTubeVideoId(input);
}

export function parseYouTubePlaylistInput(input: string) {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, "");
    if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "music.youtube.com") {
      return url.searchParams.get("list");
    }
  } catch {
    return null;
  }

  return null;
}

export function iso8601DurationToSeconds(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function bestThumbnail(thumbnails: YouTubeThumbnailMap | undefined) {
  return thumbnails?.maxres?.url ?? thumbnails?.standard?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? null;
}

function inferReleaseYear(text: string) {
  const match = text.match(/\b(19[3-9]\d|20[0-2]\d)\b/);
  return match?.[1] ?? "";
}

function inferTeluguTitle(title: string) {
  return /[\u0C00-\u0C7F]/.test(title) ? title : "";
}

export function suggestSongMetadata(title: string, description: string): SuggestedSongMetadata {
  const source = `${title}\n${description}`;
  const film = source.match(/(?:film|movie)\s*[:\-]\s*([^\n|]+)/i)?.[1]?.trim() ?? "";
  const singers = source.match(/(?:singers?|vocals?)\s*[:\-]\s*([^\n|]+)/i)?.[1]?.trim() ?? "";
  const composer = source.match(/(?:composer|music)\s*[:\-]\s*([^\n|]+)/i)?.[1]?.trim() ?? "";
  const lyricist = source.match(/(?:lyricist|lyrics)\s*[:\-]\s*([^\n|]+)/i)?.[1]?.trim() ?? "";

  return {
    title: title.replace(/\s*\|.*$/, "").trim(),
    teluguTitle: inferTeluguTitle(title),
    film,
    singers,
    composer,
    lyricist,
    releaseYear: inferReleaseYear(source),
  };
}

export function mapVideoItemToMetadata(item: YouTubeVideoApiItem): YouTubeVideoMetadata {
  const title = item.snippet?.title?.trim() || "Untitled YouTube video";
  const description = item.snippet?.description ?? "";
  const privacyStatus = item.status?.privacyStatus;
  const uploadStatus = item.status?.uploadStatus;
  const embeddable = item.status?.embeddable === true;
  const unavailable = privacyStatus === "private" || uploadStatus === "deleted";
  const availability: YouTubeAvailability = unavailable ? (privacyStatus === "private" ? "private" : "deleted") : embeddable ? "available" : "embedding_disabled";

  return {
    youtubeVideoId: item.id,
    youtubeUrl: `https://www.youtube.com/watch?v=${item.id}`,
    title,
    description,
    thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
    durationSeconds: iso8601DurationToSeconds(item.contentDetails?.duration),
    uploader: item.snippet?.channelTitle?.trim() || "Unknown uploader",
    publishedAt: item.snippet?.publishedAt ?? null,
    availability,
    embeddable,
    suggestions: suggestSongMetadata(title, description),
  };
}

export function availabilityToEmbedStatus(metadata: Pick<YouTubeVideoMetadata, "availability" | "embeddable">): EmbedStatus {
  if (metadata.availability === "available" && metadata.embeddable) return "available";
  if (metadata.availability === "embedding_disabled") return "embedding_disabled";
  return "unavailable";
}

export function getNextSequence(assignments: Array<{ sequence: number | null; active?: boolean | null }>) {
  const activeSequences = assignments.filter((assignment) => assignment.active !== false).map((assignment) => assignment.sequence ?? 0);
  return Math.max(0, ...activeSequences) + 1;
}

export function queueStatusForMetadata(duplicateSongId: string | null, metadata: Pick<YouTubeVideoMetadata, "availability" | "embeddable">): YouTubeImportStatus {
  if (duplicateSongId) return "duplicate";
  if (metadata.availability !== "available" || !metadata.embeddable) return "unavailable";
  return "pending";
}

export function assertSupportedVideoInput(input: string) {
  const id = parseYouTubeVideoInput(input);
  if (!id || !youtubeVideoIdSchema.safeParse(id).success) {
    throw new Error("Unsupported YouTube input. Use a watch URL, youtu.be URL, Shorts URL, embed URL, or raw 11-character video ID.");
  }
  return id;
}
