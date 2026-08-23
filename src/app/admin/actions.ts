"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/auth";
import { channelInputSchema, extractYouTubeVideoId, songInputSchema, taxonomyInputSchema, youtubeVideoIdSchema } from "@/lib/catalogue/validation";
import { createSongWithAssignment, findDuplicateSongId, nextSequenceForChannel, suggestedMetadataFromQueue } from "@/lib/youtube/import-service";
import { assertSupportedVideoInput, parseYouTubePlaylistInput, queueStatusForMetadata, type YouTubeVideoMetadata } from "@/lib/youtube/import";
import { fetchOneYouTubeVideoMetadata, fetchYouTubePlaylistVideoIds, fetchYouTubeVideoMetadata } from "@/lib/youtube/server";
import { eraForYear, sanitizeEditorialText } from "@/lib/catalogue/taxonomy";
import { isUuid } from "@/lib/validation/uuid";
import type { DbYouTubeImportQueue, EmbedStatus, TakedownStatus } from "@/types/database";

type ActionResult = {
  ok: boolean;
  message: string;
  code?: string;
  field?: string;
  values?: Record<string, string>;
  preview?: YouTubeVideoMetadata & {
    duplicateSongId: string | null;
    suggestedChannelId: string;
    suggestedSequence: number;
  };
  results?: Array<{ youtubeVideoId: string; status: string; message: string }>;
};

async function requireActionAdmin() {
  const context = await getAdminContext();
  if (context.status !== "ok") {
    return { context, supabase: null };
  }

  return { context, supabase: createServiceSupabaseClient() };
}

function listFromCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function channelTaxonomy(supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>, channelId: string, releaseYear: number) {
  const { data, error } = await supabase.from("channels").select("primary_language_code").eq("id", channelId).eq("active", true).single();
  if (error || !data?.primary_language_code) throw new Error("Selected channel taxonomy is unavailable.");
  return { languageCode: data.primary_language_code, eraCode: eraForYear(releaseYear) };
}

async function replaceSongTags(
  supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>,
  songId: string,
  moodCodes: string[],
  occasionCodes: string[],
) {
  const [moodDelete, occasionDelete] = await Promise.all([
    supabase.from("song_moods").delete().eq("song_id", songId),
    supabase.from("song_occasions").delete().eq("song_id", songId),
  ]);
  if (moodDelete.error || occasionDelete.error) throw new Error("Unable to replace existing taxonomy tags.");
  if (moodCodes.length) {
    const { error } = await supabase.from("song_moods").insert(moodCodes.map((moodCode) => ({ song_id: songId, mood_code: moodCode })));
    if (error) throw new Error("Unable to save mood tags.");
  }
  if (occasionCodes.length) {
    const { error } = await supabase.from("song_occasions").insert(occasionCodes.map((occasionCode) => ({ song_id: songId, occasion_code: occasionCode })));
    if (error) throw new Error("Unable to save occasion tags.");
  }
}

function formValues(formData: FormData, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? "")]));
}

function validationFailure(error: { issues: Array<{ path: PropertyKey[]; message: string }> }, values: Record<string, string>): ActionResult {
  const issue = error.issues[0];
  const field = issue?.path.join(".") || "form";
  const message = issue?.message || "Invalid song data.";
  console.warn("[admin.validation]", { code: "ADMIN_VALIDATION_FIELD_ERROR", field, message });
  return {
    ok: false,
    code: "ADMIN_VALIDATION_FIELD_ERROR",
    field,
    values,
    message: `Error summary: ${message} Field: ${field}. Explanation: The submitted value is missing or has the wrong format. Corrective action: update ${field} and submit again. Code: ADMIN_VALIDATION_FIELD_ERROR.`,
  };
}

function safeActionError(message: string, code: string, field?: string, values?: Record<string, string>): ActionResult {
  if (field) console.warn("[admin.validation]", { code, field, message });
  return { ok: false, message: `${message} Code: ${code}.`, code, field, values };
}

function revalidatePublicCatalogue(channelIds: readonly string[] = []) {
  revalidatePath("/");
  revalidatePath("/api/catalogue");
  for (const channelId of new Set(channelIds.filter(isUuid))) {
    revalidatePath(`/api/catalogue/channels/${channelId}`);
  }
}

export async function logoutAction() {
  const supabase = await createSupabaseAuthServerClient();
  await supabase?.auth.signOut();
  redirect("/admin/login");
}

export async function saveSongAction(_previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireActionAdmin();
  if (!supabase) {
    return { ok: false, message: "Unauthorized." };
  }

  const channelIds = formData.getAll("channelIds").map(String);
  const values = formValues(formData, [
    "title",
    "teluguTitle",
    "film",
    "releaseYear",
    "durationSeconds",
    "singers",
    "composer",
    "lyricist",
    "youtubeInput",
    "spotifyUrl",
    "youtubeMusicUrl",
    "editorialNote",
    "editorialNoteTelugu",
    "languageCode",
    "eraCode",
    "songStory",
    "context",
    "thumbnailUrl",
    "embedStatus",
  ]);
  const parsed = songInputSchema.safeParse({
    title: formData.get("title"),
    teluguTitle: formData.get("teluguTitle"),
    film: formData.get("film"),
    releaseYear: formData.get("releaseYear"),
    durationSeconds: formData.get("durationSeconds"),
    singers: formData.get("singers"),
    composer: formData.get("composer"),
    lyricist: formData.get("lyricist"),
    youtubeInput: formData.get("youtubeInput"),
    spotifyUrl: formData.get("spotifyUrl"),
    youtubeMusicUrl: formData.get("youtubeMusicUrl"),
    editorialNote: formData.get("editorialNote"),
    editorialNoteTelugu: formData.get("editorialNoteTelugu"),
    languageCode: formData.get("languageCode"),
    eraCode: formData.get("eraCode"),
    moodCodes: formData.getAll("moodCodes"),
    occasionCodes: formData.getAll("occasionCodes"),
    songStory: formData.get("songStory"),
    context: formData.get("context"),
    thumbnailUrl: formData.get("thumbnailUrl"),
    embedStatus: formData.get("embedStatus") || "unchecked",
    channelIds,
  });

  if (!parsed.success) {
    return validationFailure(parsed.error, values);
  }

  const youtubeVideoId = extractYouTubeVideoId(parsed.data.youtubeInput);
  if (!youtubeVideoId) {
    return safeActionError("Use a valid YouTube URL or 11-character video ID.", "ADMIN_YOUTUBE_INPUT_INVALID", "youtubeInput", values);
  }

  if (channelIds.length > 0) {
    const channelResult = await supabase.from("channels").select("id,primary_language_code").in("id", channelIds);
    const mismatch = channelResult.error || (channelResult.data ?? []).length !== channelIds.length
      || (channelResult.data ?? []).some((channel) => channel.primary_language_code !== parsed.data.languageCode);
    if (mismatch) {
      return safeActionError("Song language must match every selected channel language.", "ADMIN_SONG_LANGUAGE_MISMATCH", "languageCode", values);
    }
  }

  const songId = String(formData.get("songId") ?? "");
  const payload = {
    title: parsed.data.title,
    telugu_title: parsed.data.teluguTitle || null,
    film: parsed.data.film,
    release_year: parsed.data.releaseYear,
    duration_seconds: parsed.data.durationSeconds,
    singers: listFromCsv(parsed.data.singers),
    composer: parsed.data.composer,
    lyricist: parsed.data.lyricist || null,
    youtube_video_id: youtubeVideoId,
    youtube_url: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
    spotify_url: parsed.data.spotifyUrl || null,
    youtube_music_url: parsed.data.youtubeMusicUrl || null,
    editorial_note: parsed.data.editorialNote || null,
    editorial_note_telugu: parsed.data.editorialNoteTelugu || null,
    language_code: parsed.data.languageCode,
    era_code: parsed.data.eraCode,
    song_story: sanitizeEditorialText(parsed.data.songStory, 320),
    context: sanitizeEditorialText(parsed.data.context, 240),
    thumbnail_url: parsed.data.thumbnailUrl || null,
    embed_status: parsed.data.embedStatus,
    active: true,
  };

  const saveResult = songId
    ? await supabase.from("songs").update(payload).eq("id", songId).select("id").single()
    : await supabase.from("songs").insert(payload).select("id").single();

  if (saveResult.error || !saveResult.data) {
    return {
      ok: false,
      code: saveResult.error?.code === "23505" ? "ADMIN_SONG_DUPLICATE" : "ADMIN_SONG_SAVE_FAILED",
      values,
      message: saveResult.error?.code === "23505" ? "That YouTube video ID already exists. Code: ADMIN_SONG_DUPLICATE." : "Unable to save song. Code: ADMIN_SONG_SAVE_FAILED.",
    };
  }

  const savedSongId = saveResult.data.id;
  try {
    await replaceSongTags(supabase, savedSongId, parsed.data.moodCodes, parsed.data.occasionCodes);
  } catch (error) {
    return safeActionError(error instanceof Error ? error.message : "Unable to save song taxonomy.", "ADMIN_SONG_TAXONOMY_FAILED", "moodCodes", values);
  }
  if (channelIds.length > 0) {
    const existing = await supabase.from("channel_songs").select("channel_id").eq("song_id", savedSongId);
    const existingChannelIds = new Set((existing.data ?? []).map((row) => row.channel_id));
    const inserts = channelIds
      .filter((channelId) => !existingChannelIds.has(channelId))
      .map((channelId) => ({ channel_id: channelId, song_id: savedSongId, sequence: 999, active: true }));

    if (inserts.length > 0) {
      await supabase.from("channel_songs").insert(inserts);
    }

    await supabase.from("channel_songs").update({ active: true }).eq("song_id", savedSongId).in("channel_id", channelIds);
  }

  revalidatePath("/admin");
  revalidatePublicCatalogue(channelIds);
  return { ok: true, message: songId ? "Song updated." : "Song added." };
}

export async function previewYouTubeVideoImportAction(_previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireActionAdmin();
  if (!supabase) return { ok: false, message: "Unauthorized.", code: "ADMIN_UNAUTHORIZED" };

  const youtubeInput = String(formData.get("youtubeInput") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  const values = formValues(formData, ["youtubeInput", "channelId"]);

  let videoId: string;
  try {
    videoId = assertSupportedVideoInput(youtubeInput);
  } catch (error) {
    return safeActionError(error instanceof Error ? error.message : "Unsupported YouTube input.", "ADMIN_YOUTUBE_INPUT_INVALID", "youtubeInput", values);
  }

  try {
    const metadata = await fetchOneYouTubeVideoMetadata(videoId);
    const [duplicateSongId, suggestedSequence] = await Promise.all([
      findDuplicateSongId(supabase, metadata.youtubeVideoId),
      channelId ? nextSequenceForChannel(supabase, channelId) : Promise.resolve(1),
    ]);
    return {
      ok: true,
      message: duplicateSongId ? "Video metadata loaded. This YouTube video already exists in the catalogue." : "Video metadata loaded. Review and confirm before importing.",
      code: duplicateSongId ? "ADMIN_YOUTUBE_DUPLICATE" : "ADMIN_YOUTUBE_PREVIEW_READY",
      values,
      preview: {
        ...metadata,
        duplicateSongId,
        suggestedChannelId: channelId,
        suggestedSequence,
      },
    };
  } catch (error) {
    return safeActionError(error instanceof Error ? error.message : "Unable to fetch YouTube metadata.", "ADMIN_YOUTUBE_FETCH_FAILED", "youtubeInput", values);
  }
}

export async function saveYouTubeVideoImportAction(_previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireActionAdmin();
  if (!supabase) return { ok: false, message: "Unauthorized.", code: "ADMIN_UNAUTHORIZED" };

  const youtubeVideoId = String(formData.get("youtubeVideoId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  const sequence = Number(formData.get("sequence") ?? 0);
  const values = formValues(formData, ["youtubeVideoId", "title", "film", "releaseYear", "singers", "composer", "lyricist", "teluguTitle", "channelId", "sequence", "languageCode", "eraCode", "songStory", "context"]);

  if (!youtubeVideoIdSchema.safeParse(youtubeVideoId).success) return safeActionError("YouTube video ID is invalid.", "ADMIN_YOUTUBE_ID_INVALID", "youtubeVideoId", values);
  if (!channelId) return safeActionError("Choose one website mood channel before importing.", "ADMIN_IMPORT_CHANNEL_REQUIRED", "channelId", values);
  if (!Number.isInteger(sequence) || sequence < 1) return safeActionError("Sequence must be a positive whole number.", "ADMIN_IMPORT_SEQUENCE_INVALID", "sequence", values);

  const metadata = await fetchOneYouTubeVideoMetadata(youtubeVideoId);
  if (metadata.availability !== "available" || !metadata.embeddable) {
    return safeActionError("This video is unavailable or non-embeddable. Confirm another source before importing.", "ADMIN_IMPORT_AVAILABILITY_REQUIRED", "availability", values);
  }

  const releaseYear = Number(formData.get("releaseYear"));
  if (!Number.isInteger(releaseYear) || releaseYear < 1900 || releaseYear > 2100) {
    return safeActionError("Release year must be between 1900 and 2100.", "ADMIN_IMPORT_RELEASE_YEAR_INVALID", "releaseYear", values);
  }
  const taxonomy = taxonomyInputSchema.safeParse({
    languageCode: formData.get("languageCode"),
    eraCode: formData.get("eraCode"),
    moodCodes: formData.getAll("moodCodes"),
    occasionCodes: formData.getAll("occasionCodes"),
    songStory: formData.get("songStory"),
    context: formData.get("context"),
  });
  if (!taxonomy.success) return validationFailure(taxonomy.error, values);
  try {
    const requiredTaxonomy = await channelTaxonomy(supabase, channelId, releaseYear);
    if (requiredTaxonomy.languageCode !== taxonomy.data.languageCode) {
      return safeActionError("Song language must match the selected channel language.", "ADMIN_IMPORT_LANGUAGE_MISMATCH", "languageCode", values);
    }
  } catch (error) {
    return safeActionError(error instanceof Error ? error.message : "Channel taxonomy is unavailable.", "ADMIN_IMPORT_CHANNEL_TAXONOMY_FAILED", "channelId", values);
  }

  try {
    const result = await createSongWithAssignment(supabase, {
      metadata,
      channelId,
      sequence,
      title: String(formData.get("title") ?? ""),
      teluguTitle: String(formData.get("teluguTitle") ?? ""),
      film: String(formData.get("film") ?? ""),
      releaseYear,
      singers: String(formData.get("singers") ?? ""),
      composer: String(formData.get("composer") ?? ""),
      lyricist: String(formData.get("lyricist") ?? ""),
      languageCode: taxonomy.data.languageCode,
      eraCode: taxonomy.data.eraCode,
      moodCodes: taxonomy.data.moodCodes,
      occasionCodes: taxonomy.data.occasionCodes,
      songStory: sanitizeEditorialText(taxonomy.data.songStory, 320),
      context: sanitizeEditorialText(taxonomy.data.context, 240),
    });
    revalidatePath("/admin");
    revalidatePublicCatalogue([channelId]);
    return {
      ok: result.status === "imported",
      code: result.status === "duplicate" ? "ADMIN_YOUTUBE_DUPLICATE" : "ADMIN_YOUTUBE_IMPORTED",
      message: result.status === "duplicate" ? "That YouTube video already exists. Code: ADMIN_YOUTUBE_DUPLICATE." : "Imported one YouTube song and assigned it to the selected channel.",
      values,
    };
  } catch (error) {
    return safeActionError(error instanceof Error ? error.message : "Unable to import song.", "ADMIN_YOUTUBE_IMPORT_FAILED", undefined, values);
  }
}

export async function importYouTubePlaylistAction(_previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireActionAdmin();
  if (!supabase) return { ok: false, message: "Unauthorized.", code: "ADMIN_UNAUTHORIZED" };

  const playlistInput = String(formData.get("playlistInput") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  const startingSequence = Number(formData.get("startingSequence") || 1);
  const values = formValues(formData, ["playlistInput", "channelId", "startingSequence"]);
  const playlistId = parseYouTubePlaylistInput(playlistInput);
  if (!playlistId) return safeActionError("Use a valid YouTube playlist URL or playlist ID.", "ADMIN_PLAYLIST_INPUT_INVALID", "playlistInput", values);

  try {
    const playlist = await fetchYouTubePlaylistVideoIds(playlistInput);
    const metadataList = await fetchYouTubeVideoMetadata(playlist.videoIds);
    const results: ActionResult["results"] = [];
    let nextSequence = Number.isInteger(startingSequence) && startingSequence > 0 ? startingSequence : 1;

    for (const metadata of metadataList) {
      const duplicateSongId = await findDuplicateSongId(supabase, metadata.youtubeVideoId);
      const status = queueStatusForMetadata(duplicateSongId, metadata);
      const payload = {
        youtube_video_id: metadata.youtubeVideoId,
        youtube_url: metadata.youtubeUrl,
        playlist_id: playlist.playlistId,
        source_title: metadata.title,
        source_description: metadata.description || null,
        thumbnail_url: metadata.thumbnailUrl,
        duration_seconds: metadata.durationSeconds,
        uploader: metadata.uploader,
        published_at: metadata.publishedAt,
        availability: metadata.availability,
        embeddable: metadata.embeddable,
        duplicate_song_id: duplicateSongId,
        suggested_metadata: metadata.suggestions,
        channel_id: channelId || null,
        sequence: status === "pending" ? nextSequence : null,
        status,
      };
      const { error } = await supabase.from("youtube_import_queue").upsert(payload, { onConflict: "youtube_video_id,playlist_id" });
      if (!error && status === "pending") nextSequence += 1;
      results.push({ youtubeVideoId: metadata.youtubeVideoId, status: error ? "failed" : status, message: error ? "Queue save failed" : "Queued for review" });
    }

    revalidatePath("/admin");
    return { ok: true, code: "ADMIN_PLAYLIST_QUEUED", message: `Playlist scan complete. ${results.length} item(s) reviewed for queue.`, values, results };
  } catch (error) {
    return safeActionError(error instanceof Error ? error.message : "Unable to import playlist.", "ADMIN_PLAYLIST_IMPORT_FAILED", "playlistInput", values);
  }
}

type QueueImportOverride = {
  channelId?: string;
  sequence?: number;
  title?: string;
  film?: string;
  singers?: string;
  composer?: string;
  releaseYear?: number;
};

async function importQueueItem(supabase: NonNullable<Awaited<ReturnType<typeof requireActionAdmin>>["supabase"]>, item: DbYouTubeImportQueue, override?: QueueImportOverride) {
  if (item.status === "imported") return { youtubeVideoId: item.youtube_video_id, status: "duplicate", message: "Already imported" };
  if (item.duplicate_song_id) {
    await supabase.from("youtube_import_queue").update({ status: "duplicate", reviewed_at: new Date().toISOString() }).eq("id", item.id);
    return { youtubeVideoId: item.youtube_video_id, status: "duplicate", message: "Already in catalogue" };
  }
  if (item.availability !== "available" || !item.embeddable) {
    await supabase.from("youtube_import_queue").update({ status: "unavailable", reviewed_at: new Date().toISOString() }).eq("id", item.id);
    return { youtubeVideoId: item.youtube_video_id, status: "unavailable", message: "Unavailable or non-embeddable" };
  }

  const channelId = override?.channelId || item.channel_id;
  const sequence = override?.sequence || item.sequence;
  if (!channelId || !sequence) return { youtubeVideoId: item.youtube_video_id, status: "needs review", message: "Channel and sequence are required" };

  const metadata = await fetchOneYouTubeVideoMetadata(item.youtube_video_id);
  const suggestions = suggestedMetadataFromQueue(item);
  const title = override?.title?.trim() || suggestions.title.trim();
  const film = override?.film?.trim() || suggestions.film.trim();
  const singers = override?.singers?.trim() || suggestions.singers.trim();
  const composer = override?.composer?.trim() || suggestions.composer.trim();
  const releaseYear = override?.releaseYear || Number(suggestions.releaseYear);
  if (!title || !film || !singers || !composer || !Number.isInteger(releaseYear) || releaseYear < 1900 || releaseYear > 2100) {
    return { youtubeVideoId: item.youtube_video_id, status: "needs review", message: "Confirm title, film, year, singers and composer before import" };
  }
  const taxonomy = await channelTaxonomy(supabase, channelId, releaseYear);
  const result = await createSongWithAssignment(supabase, {
    metadata,
    channelId,
    sequence,
    title,
    teluguTitle: suggestions.teluguTitle,
    film,
    releaseYear,
    singers,
    composer,
    lyricist: suggestions.lyricist,
    ...taxonomy,
  });
  await supabase
    .from("youtube_import_queue")
    .update({ status: result.status === "duplicate" ? "duplicate" : "imported", imported_song_id: result.songId, reviewed_at: new Date().toISOString(), channel_id: channelId, sequence })
    .eq("id", item.id);
  return { youtubeVideoId: item.youtube_video_id, status: result.status, message: result.status === "imported" ? "Imported" : "Duplicate" };
}

export async function importQueuedYouTubeItemAction(formData: FormData) {
  const { supabase } = await requireActionAdmin();
  if (!supabase) return;
  const itemId = String(formData.get("queueId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  const sequence = Number(formData.get("sequence") ?? 0);
  const { data: item } = await supabase.from("youtube_import_queue").select("*").eq("id", itemId).single();
  if (item) await importQueueItem(supabase, item as DbYouTubeImportQueue, {
    channelId,
    sequence,
    title: String(formData.get("title") ?? ""),
    film: String(formData.get("film") ?? ""),
    releaseYear: Number(formData.get("releaseYear") ?? 0),
    singers: String(formData.get("singers") ?? ""),
    composer: String(formData.get("composer") ?? ""),
  });
  revalidatePath("/admin");
  revalidatePublicCatalogue([channelId]);
}

export async function rejectQueuedYouTubeItemAction(formData: FormData) {
  const { supabase } = await requireActionAdmin();
  if (!supabase) return;
  await supabase.from("youtube_import_queue").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", String(formData.get("queueId") ?? ""));
  revalidatePath("/admin");
}

export async function bulkImportQueuedYouTubeItemsAction(_previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireActionAdmin();
  if (!supabase) return { ok: false, message: "Unauthorized.", code: "ADMIN_UNAUTHORIZED" };
  const ids = formData.getAll("queueIds").map(String);
  const channelId = String(formData.get("bulkChannelId") ?? "");
  const startingSequence = Number(formData.get("bulkStartingSequence") || 1);
  const results: NonNullable<ActionResult["results"]> = [];
  const { data } = await supabase.from("youtube_import_queue").select("*").in("id", ids);
  let sequence = Number.isInteger(startingSequence) && startingSequence > 0 ? startingSequence : 1;
  for (const item of (data ?? []) as DbYouTubeImportQueue[]) {
    try {
      results.push(await importQueueItem(supabase, item, { channelId: channelId || item.channel_id || undefined, sequence: sequence || item.sequence || undefined }));
      sequence += 1;
    } catch (error) {
      results.push({ youtubeVideoId: item.youtube_video_id, status: "failed", message: error instanceof Error ? error.message : "Failed" });
    }
  }
  revalidatePath("/admin");
  revalidatePublicCatalogue(channelId ? [channelId] : []);
  return { ok: true, code: "ADMIN_BULK_IMPORT_COMPLETE", message: `Bulk import complete. ${results.length} item(s) processed.`, results };
}

export async function bulkRejectQueuedYouTubeItemsAction(_previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireActionAdmin();
  if (!supabase) return { ok: false, message: "Unauthorized.", code: "ADMIN_UNAUTHORIZED" };
  const ids = formData.getAll("queueIds").map(String);
  if (ids.length === 0) return { ok: false, message: "Select at least one queued item. Code: ADMIN_QUEUE_SELECTION_REQUIRED.", code: "ADMIN_QUEUE_SELECTION_REQUIRED" };
  await supabase.from("youtube_import_queue").update({ status: "rejected", reviewed_at: new Date().toISOString() }).in("id", ids);
  revalidatePath("/admin");
  return { ok: true, message: `Rejected ${ids.length} queued item(s).`, code: "ADMIN_BULK_REJECT_COMPLETE" };
}

export async function bulkRejectQueuedYouTubeItemsFormAction(formData: FormData) {
  await bulkRejectQueuedYouTubeItemsAction(null, formData);
}

export async function toggleSongActiveAction(formData: FormData) {
  const { supabase } = await requireActionAdmin();
  if (!supabase) {
    return;
  }

  const songId = String(formData.get("songId") ?? "");
  const active = String(formData.get("active")) !== "true";
  await supabase.from("songs").update({ active }).eq("id", songId);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function setSongStatusAction(formData: FormData) {
  const { supabase } = await requireActionAdmin();
  if (!supabase) {
    return;
  }

  const songId = String(formData.get("songId") ?? "");
  const embedStatus = String(formData.get("embedStatus")) as EmbedStatus;
  await supabase.from("songs").update({ embed_status: embedStatus }).eq("id", songId);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function assignSongAction(formData: FormData) {
  const { supabase } = await requireActionAdmin();
  if (!supabase) {
    return;
  }

  const songId = String(formData.get("songId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  const sequence = Number(formData.get("sequence") ?? 999);
  if (!isUuid(songId) || !isUuid(channelId) || !Number.isInteger(sequence) || sequence < 1) return;
  await supabase.from("channel_songs").upsert({ song_id: songId, channel_id: channelId, sequence, active: true }, { onConflict: "channel_id,song_id" });
  revalidatePath("/admin");
  revalidatePublicCatalogue([channelId]);
}

export async function reorderAssignmentAction(formData: FormData) {
  const { supabase } = await requireActionAdmin();
  if (!supabase) {
    return;
  }

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const sequence = Number(formData.get("sequence") ?? 1);
  const active = String(formData.get("active")) === "true";
  await supabase.from("channel_songs").update({ sequence, active }).eq("id", assignmentId);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function moveAssignmentAction(formData: FormData) {
  const { supabase } = await requireActionAdmin();
  if (!supabase) {
    return;
  }

  const channelId = String(formData.get("channelId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const direction = String(formData.get("direction")) === "up" ? -1 : 1;
  const { data } = await supabase.from("channel_songs").select("id").eq("channel_id", channelId).eq("active", true).order("sequence", { ascending: true }).order("created_at", { ascending: true });
  const ids = (data ?? []).map((assignment) => assignment.id);
  const index = ids.indexOf(assignmentId);

  if (index === -1) {
    return;
  }

  const nextIndex = Math.max(0, Math.min(ids.length - 1, index + direction));
  const reordered = [...ids];
  const [item] = reordered.splice(index, 1);
  reordered.splice(nextIndex, 0, item);
  await supabase.rpc("reorder_channel_assignments", { p_channel_id: channelId, p_assignment_ids: reordered });
  revalidatePath("/admin");
  revalidatePublicCatalogue([channelId]);
}

export async function removeAssignmentAction(formData: FormData) {
  const { context, supabase } = await requireActionAdmin();
  if (!supabase || context.status !== "ok") {
    return;
  }

  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!isUuid(assignmentId) || formData.get("confirmation") !== "REMOVE") return;
  await supabase.rpc("unlink_channel_song", { p_assignment_id: assignmentId, p_actor_id: context.userId });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function moveSongAssignmentAction(formData: FormData) {
  const { context, supabase } = await requireActionAdmin();
  if (!supabase || context.status !== "ok") return;
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const targetChannelId = String(formData.get("targetChannelId") ?? "");
  const sequence = Number(formData.get("sequence") ?? 1);
  if (!isUuid(assignmentId) || !isUuid(targetChannelId) || !Number.isInteger(sequence) || sequence < 1 || formData.get("confirmation") !== "MOVE") return;
  await supabase.rpc("move_channel_song", {
    p_assignment_id: assignmentId,
    p_target_channel_id: targetChannelId,
    p_sequence: sequence,
    p_actor_id: context.userId,
  });
  revalidatePath("/admin");
  revalidatePublicCatalogue([targetChannelId]);
}

export async function deleteSongAction(formData: FormData) {
  const { context, supabase } = await requireActionAdmin();
  if (!supabase || context.status !== "ok") return;
  const songId = String(formData.get("songId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (!isUuid(songId) || confirmation !== "DELETE") return;
  await supabase.rpc("soft_delete_catalogue_song", {
    p_song_id: songId,
    p_actor_id: context.userId,
    p_confirmation: confirmation,
  });
  revalidatePath("/admin");
  revalidatePublicCatalogue();
}

export async function updateChannelAction(_previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireActionAdmin();
  if (!supabase) {
    return { ok: false, message: "Unauthorized." };
  }

  const parsed = channelInputSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    teluguName: formData.get("teluguName"),
    positioning: formData.get("positioning"),
    backgroundImageUrl: formData.get("backgroundImageUrl"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    accentColor: formData.get("accentColor"),
    displayOrder: formData.get("displayOrder"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid channel data." };
  }

  const { error } = await supabase
    .from("channels")
    .update({
      name: parsed.data.name,
      telugu_name: parsed.data.teluguName,
      positioning: parsed.data.positioning,
      background_image_url: parsed.data.backgroundImageUrl,
      primary_color: parsed.data.primaryColor,
      secondary_color: parsed.data.secondaryColor,
      accent_color: parsed.data.accentColor,
      display_order: parsed.data.displayOrder,
    })
    .eq("id", parsed.data.id);

  revalidatePath("/admin");
  revalidatePublicCatalogue([parsed.data.id]);
  return error ? { ok: false, message: "Unable to update channel." } : { ok: true, message: "Channel updated." };
}

export async function updateTakedownAction(formData: FormData) {
  const { supabase } = await requireActionAdmin();
  if (!supabase) {
    return;
  }

  const requestId = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "new") as TakedownStatus;
  const internalNotes = String(formData.get("internalNotes") ?? "").trim() || null;
  const disableSong = formData.get("disableSong") === "on";
  const songId = String(formData.get("songId") ?? "");

  await supabase.from("takedown_requests").update({ status, internal_notes: internalNotes }).eq("id", requestId);

  if (disableSong && songId) {
    await supabase.from("songs").update({ active: false }).eq("id", songId);
  }

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function checkYouTubeAvailabilityAction(formData: FormData) {
  const { supabase } = await requireActionAdmin();
  if (!supabase) {
    return;
  }

  const songId = String(formData.get("songId") ?? "");
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    await supabase.from("songs").update({ last_checked_at: new Date().toISOString() }).eq("id", songId);
    revalidatePath("/admin");
    return;
  }

  const { data: song } = await supabase.from("songs").select("youtube_video_id").eq("id", songId).single();
  if (!song || !youtubeVideoIdSchema.safeParse(song.youtube_video_id).success) {
    return;
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "status");
  url.searchParams.set("id", song.youtube_video_id);
  url.searchParams.set("key", apiKey);

  let embedStatus: EmbedStatus = "unavailable";
  try {
    const response = await fetch(url);
    if (response.ok) {
      const body = (await response.json()) as { items?: Array<{ status?: { embeddable?: boolean } }> };
      const item = body.items?.[0];
      embedStatus = item?.status?.embeddable ? "available" : item ? "embedding_disabled" : "unavailable";
    }
  } catch {
    embedStatus = "unavailable";
  }

  await supabase.from("songs").update({ embed_status: embedStatus, last_checked_at: new Date().toISOString() }).eq("id", songId);
  revalidatePath("/admin");
  revalidatePath("/");
}
