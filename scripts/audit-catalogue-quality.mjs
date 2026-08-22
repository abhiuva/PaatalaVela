#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] ??= value;
  }
}

function candidate(song, reason) {
  return { id: song.id, title: song.title, youtubeVideoId: song.youtube_video_id, reason };
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is required.");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: songs, error } = await supabase.from("songs").select("id,title,film,release_year,singers,composer,youtube_video_id,duration_seconds,thumbnail_url,embed_status,active").order("id");
  if (error) throw new Error(`Catalogue audit query failed: ${error.code ?? "unknown"}`);

  const seen = new Map();
  const seenTitles = new Map();
  const candidates = [];
  for (const song of songs ?? []) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(song.youtube_video_id)) candidates.push(candidate(song, "Invalid YouTube video ID format"));
    if (seen.has(song.youtube_video_id)) candidates.push(candidate(song, `Duplicate YouTube ID; first song ${seen.get(song.youtube_video_id)}`));
    else seen.set(song.youtube_video_id, song.id);
    const titleKey = `${song.title.trim().toLowerCase()}|${song.film.trim().toLowerCase()}`;
    if (seenTitles.has(titleKey)) candidates.push(candidate(song, `Possible duplicate title and film; first song ${seenTitles.get(titleKey)}`));
    else seenTitles.set(titleKey, song.id);
    if (!song.duration_seconds) candidates.push(candidate(song, "Missing duration"));
    if (!song.thumbnail_url) candidates.push(candidate(song, "Missing artwork"));
    if (song.embed_status !== "available") candidates.push(candidate(song, `Availability requires review: ${song.embed_status}`));
    if (!song.film?.trim() || !song.composer?.trim() || !song.singers?.length) candidates.push(candidate(song, "Missing required catalogue metadata"));
  }

  const taxonomy = await supabase.from("songs").select("id,title,language_code,era_code,song_moods(mood_code),song_occasions(occasion_code)");
  const taxonomyRows = taxonomy.error ? null : (taxonomy.data ?? []);
  const untagged = taxonomyRows?.map((song) => ({
    id: song.id,
    title: song.title,
    missing: [!song.language_code && "language", !song.era_code && "era", song.song_moods.length === 0 && "mood", song.song_occasions.length === 0 && "occasion"].filter(Boolean),
  })).filter((song) => song.missing.length > 0) ?? null;
  const coverage = taxonomyRows ? {
    language: taxonomyRows.filter((song) => song.language_code).length,
    era: taxonomyRows.filter((song) => song.era_code).length,
    mood: taxonomyRows.filter((song) => song.song_moods.length > 0).length,
    occasion: taxonomyRows.filter((song) => song.song_occasions.length > 0).length,
    byLanguage: taxonomyRows.reduce((counts, song) => ({ ...counts, [song.language_code]: (counts[song.language_code] ?? 0) + 1 }), {}),
  } : null;
  const assignments = await supabase.from("channel_songs").select("id,active,channels(id,slug,primary_language_code),songs(id,title,language_code,embed_status,active)");
  const activeAssignments = assignments.error ? null : (assignments.data ?? []).filter((assignment) => assignment.active);
  const assignmentMismatches = activeAssignments?.filter((assignment) => assignment.channels?.primary_language_code !== assignment.songs?.language_code).map((assignment) => ({ assignmentId: assignment.id, channel: assignment.channels?.slug, songId: assignment.songs?.id, songTitle: assignment.songs?.title })) ?? null;
  const hindiAssignments = activeAssignments?.filter((assignment) => assignment.channels?.slug === "hindi-hits").map((assignment) => ({ assignmentId: assignment.id, songId: assignment.songs?.id, language: assignment.songs?.language_code, availability: assignment.songs?.embed_status, active: assignment.songs?.active })) ?? null;
  console.log(JSON.stringify({ auditedAt: new Date().toISOString(), songCount: songs?.length ?? 0, taxonomyMigrationApplied: !taxonomy.error, taxonomyCoverage: coverage, untaggedSongs: untagged, assignmentMismatches, hindiAssignments, candidates }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Catalogue audit failed."); process.exitCode = 1; });
