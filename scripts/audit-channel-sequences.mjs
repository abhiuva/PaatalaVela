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

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = key(row);
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  return groups;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is required.");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const [channelsResult, songsResult, assignmentsResult, backupResult] = await Promise.all([
    supabase.from("channels").select("id,name,slug,primary_language_code,active").order("display_order"),
    supabase.from("songs").select("id,title,youtube_video_id,language_code,active,embed_status,created_at").order("created_at"),
    supabase.from("channel_songs").select("id,channel_id,song_id,sequence,active,created_at,channels(id,name,slug,primary_language_code,active),songs(id,title,youtube_video_id,language_code,active,embed_status)").order("channel_id").order("sequence").order("created_at").order("id"),
    supabase.from("channel_sequence_repair_backup").select("assignment_id,channel_id,song_id,original_sequence,repaired_sequence").eq("repair_id", "20260824130000"),
  ]);
  const failure = channelsResult.error ?? songsResult.error ?? assignmentsResult.error ?? backupResult.error;
  if (failure) throw new Error(`Sequence audit query failed: ${failure.code ?? "unknown"}`);

  const channels = channelsResult.data ?? [];
  const songs = songsResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const backupRows = backupResult.data ?? [];
  const occurrenceGroups = groupBy(assignments, (row) => `${row.channel_id}:${row.sequence}`);
  const duplicateSequenceRows = assignments
    .filter((row) => occurrenceGroups.get(`${row.channel_id}:${row.sequence}`).length > 1)
    .map((row) => ({
      channelId: row.channel_id,
      channelName: row.channels?.name ?? null,
      assignmentId: row.id,
      songId: row.song_id,
      songTitle: row.songs?.title ?? null,
      youtubeVideoId: row.songs?.youtube_video_id ?? null,
      sequence: row.sequence,
      createdAt: row.created_at,
      updatedAt: null,
      assignmentActive: row.active,
      songActive: row.songs?.active ?? null,
      availability: row.songs?.embed_status ?? null,
      duplicateOccurrenceCount: occurrenceGroups.get(`${row.channel_id}:${row.sequence}`).length,
    }));
  const pairGroups = groupBy(assignments, (row) => `${row.channel_id}:${row.song_id}`);
  const youtubeGroups = groupBy(songs, (row) => row.youtube_video_id);
  const assignedSongIds = new Set(assignments.map((row) => row.song_id));

  const channelSummaries = channels.map((channel) => {
    const rows = assignments.filter((row) => row.channel_id === channel.id && row.active);
    const ordered = [...rows].sort((left, right) => left.sequence - right.sequence || left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id));
    const sequences = ordered.map((row) => row.sequence);
    const expected = Array.from({ length: ordered.length }, (_, index) => index + 1);
    return {
      channelId: channel.id,
      channelName: channel.name,
      slug: channel.slug,
      activeAssignmentCount: rows.length,
      currentSequences: sequences,
      hasGapsAgainstContiguousOneBasedOrder: JSON.stringify(sequences) !== JSON.stringify(expected),
      repairedOrder: ordered.map((row, index) => ({ assignmentId: row.id, songId: row.song_id, oldSequence: row.sequence, newSequence: index + 1 })),
    };
  });

  const output = {
    auditedAt: new Date().toISOString(),
    schemaEvidence: {
      primaryKey: "channel_songs.id UUID",
      foreignKeys: ["channel_id -> channels.id ON DELETE CASCADE", "song_id -> songs.id ON DELETE CASCADE"],
      sequenceType: "integer NOT NULL with positive-value check",
      updatedAtAvailable: false,
      knownUniqueConstraints: ["(channel_id, song_id)", "(channel_id, sequence)"],
      missingRecommendedConstraint: null,
    },
    repairBackup: {
      repairId: "20260824130000",
      rowCount: backupRows.length,
      changedCount: backupRows.filter((row) => row.original_sequence !== row.repaired_sequence).length,
      reconcilesCurrentRelationships: backupRows.length === assignments.length && backupRows.every((backup) => assignments.some((assignment) => assignment.id === backup.assignment_id && assignment.channel_id === backup.channel_id && assignment.song_id === backup.song_id)),
    },
    counts: { channels: channels.length, songs: songs.length, assignments: assignments.length, activeAssignments: assignments.filter((row) => row.active).length },
    duplicateSequenceRows,
    duplicateChannelSongAssignments: [...pairGroups.values()].filter((rows) => rows.length > 1).flat().map((row) => ({ assignmentId: row.id, channelId: row.channel_id, songId: row.song_id })),
    nullSequences: assignments.filter((row) => row.sequence === null).map((row) => row.id),
    nonPositiveSequences: assignments.filter((row) => row.sequence !== null && row.sequence <= 0).map((row) => ({ assignmentId: row.id, sequence: row.sequence })),
    orphanAssignments: assignments.filter((row) => !row.channels || !row.songs).map((row) => ({ assignmentId: row.id, channelId: row.channel_id, songId: row.song_id })),
    activeAssignmentsWithInactiveSongs: assignments.filter((row) => row.active && row.songs?.active === false).map((row) => ({ assignmentId: row.id, channelId: row.channel_id, songId: row.song_id, songTitle: row.songs?.title })),
    wrongLanguageAssignments: assignments.filter((row) => row.channels?.primary_language_code && row.songs?.language_code !== row.channels.primary_language_code).map((row) => ({ assignmentId: row.id, channelId: row.channel_id, songId: row.song_id, channelLanguage: row.channels?.primary_language_code, songLanguage: row.songs?.language_code })),
    duplicateYoutubeSongRecords: [...youtubeGroups.entries()].filter(([, rows]) => rows.length > 1).map(([youtubeVideoId, rows]) => ({ youtubeVideoId, songs: rows.map((song) => ({ id: song.id, title: song.title })) })),
    unassignedSongs: songs.filter((song) => !assignedSongIds.has(song.id)).map((song) => ({ id: song.id, title: song.title, youtubeVideoId: song.youtube_video_id, active: song.active, availability: song.embed_status, createdAt: song.created_at })),
    channelSummaries,
  };
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Channel sequence audit failed.");
  process.exitCode = 1;
});
