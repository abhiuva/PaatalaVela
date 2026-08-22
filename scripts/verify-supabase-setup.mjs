#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const EXPECTED_CHANNELS = [
  ["suprabhata-melodies", 5, 9, true],
  ["tea-shop-classics", 9, 13, true],
  ["ilaiyaraaja-era", 13, 17, true],
  ["prema-viraham", 17, 21, true],
  ["mass-beat-centre", 21, 23, true],
  ["highway-ratri", 23, 5, true],
  ["english-hits", 0, 0, false],
  ["hindi-hits", 0, 0, false],
];
const EXPECTED_TABLES = [
  "channels",
  "songs",
  "channel_songs",
  "admin_profiles",
  "takedown_requests",
  "listening_events",
  "daily_channel_metrics",
  "sponsors",
  "sponsor_campaigns",
  "daily_sponsor_metrics",
  "song_requests",
  "youtube_import_queue",
  "feedback_submissions",
  "active_listener_sessions",
  "content_languages",
  "content_eras",
  "content_moods",
  "content_occasions",
  "song_moods",
  "song_occasions",
  "catalogue_admin_events",
];

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return { envPath, parsed: {}, exists: false };
  }

  const parsed = {};
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
    process.env[key] ??= value;
  }

  return { envPath, parsed, exists: true };
}

function envStatus(key, value) {
  if (!value) return { key, ok: false, status: "missing" };
  if (key === "NEXT_PUBLIC_SUPABASE_URL") {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
        return { key, ok: false, status: "malformed" };
      }
    } catch {
      return { key, ok: false, status: "malformed" };
    }
  }
  if (key.endsWith("_KEY") && value.length < 40) {
    return { key, ok: false, status: "too short" };
  }
  return { key, ok: true, status: "configured" };
}

function reportLine(label, ok, detail = "") {
  const state = ok ? "PASS" : "FAIL";
  console.log(`${state} ${label}${detail ? ` - ${detail}` : ""}`);
}

async function schemaProbe(client, table, columns = "*") {
  return client.from(table).select(columns).limit(0);
}

async function headCount(client, table, columns = "*") {
  return client.from(table).select(columns, { count: "exact", head: true });
}

async function main() {
  const loaded = loadEnvLocal();
  console.log("Supabase setup verification");
  console.log(`.env.local: ${loaded.exists ? "found" : "missing"}`);

  const statuses = REQUIRED_ENV.map((key) => envStatus(key, process.env[key]));
  for (const item of statuses) {
    reportLine(`env ${item.key}`, item.ok, item.status);
  }

  if (statuses.some((item) => !item.ok)) {
    console.log("Stopped before network checks because required Supabase environment is incomplete.");
    process.exitCode = 1;
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
  const anon = createClient(url, anonKey, clientOptions);
  const service = createClient(url, serviceRoleKey, clientOptions);

  let failures = 0;

  const authResult = await service.auth.admin.listUsers({ page: 1, perPage: 1 });
  const authOk = !authResult.error;
  if (!authOk) failures += 1;
  reportLine("Supabase Auth admin API reachable", authOk, authResult.error?.message);

  for (const table of EXPECTED_TABLES) {
    const { error } = await schemaProbe(service, table);
    const ok = !error;
    if (!ok) failures += 1;
    reportLine(`table public.${table}`, ok, error?.message);
  }

  const { data: channels, error: channelsError } = await service
    .from("channels")
    .select("slug,start_hour,end_hour,scheduled,active")
    .order("display_order", { ascending: true });
  const expectedBySlug = new Map(EXPECTED_CHANNELS.map(([slug, start, end, scheduled]) => [slug, { start, end, scheduled }]));
  const seenChannels = new Set();
  let channelSeedOk = !channelsError;
  if (channelsError) {
    failures += 1;
  } else {
    for (const channel of channels ?? []) {
      const expected = expectedBySlug.get(channel.slug);
      if (!expected) continue;
      seenChannels.add(channel.slug);
      if (channel.start_hour !== expected.start || channel.end_hour !== expected.end || channel.scheduled !== expected.scheduled || channel.active !== true) {
        channelSeedOk = false;
      }
    }
    channelSeedOk = channelSeedOk && seenChannels.size === EXPECTED_CHANNELS.length;
    if (!channelSeedOk) failures += 1;
  }
  reportLine("six locked channels plus English and Hindi on-demand channels seeded", channelSeedOk, channelsError?.message);

  const adminSchema = await schemaProbe(service, "admin_profiles", "id,display_name,role,active,created_at");
  const adminCount = await headCount(service, "admin_profiles", "id");
  const adminSchemaOk = !adminSchema.error && !adminCount.error;
  if (!adminSchemaOk) failures += 1;
  reportLine(
    "admin_profiles fields readable by service role",
    adminSchemaOk,
    adminSchema.error?.message ?? `admin profiles: ${adminCount.count ?? 0}`,
  );

  const publicChannels = await anon.from("channels").select("slug").eq("active", true).limit(1);
  const publicPlayableSongs = await anon.from("songs").select("id,title,youtube_video_id,active,embed_status,duration_seconds").eq("active", true).eq("embed_status", "available");
  const publicAssignments = await anon
    .from("channel_songs")
    .select("id,sequence,active,channels(slug,active),songs(id,title,youtube_video_id,active,embed_status,duration_seconds)")
    .eq("active", true)
    .limit(20);
  const publicProfiles = await anon.from("admin_profiles").select("id").limit(1);
  const publicTakedowns = await anon.from("takedown_requests").select("id").limit(1);
  const publicImportQueue = await anon.from("youtube_import_queue").select("id").limit(1);
  const publicPresence = await anon.from("active_listener_sessions").select("session_hash").limit(1);
  const publicChannelOk = !publicChannels.error;
  const publicPlayableSongsOk = !publicPlayableSongs.error && (publicPlayableSongs.data ?? []).length > 0;
  const publicAssignmentsOk = !publicAssignments.error && (publicAssignments.data ?? []).some((assignment) => {
    const song = assignment.songs;
    const channel = assignment.channels;
    return assignment.active === true && channel?.active === true && song?.active === true && song?.embed_status === "available" && Boolean(song?.youtube_video_id);
  });
  const profilesRestricted = Boolean(publicProfiles.error) || (publicProfiles.data ?? []).length === 0;
  const takedownsRestricted = Boolean(publicTakedowns.error) || (publicTakedowns.data ?? []).length === 0;
  const importQueueRestricted = Boolean(publicImportQueue.error) || (publicImportQueue.data ?? []).length === 0;
  const presenceRestricted = Boolean(publicPresence.error) || (publicPresence.data ?? []).length === 0;
  const rlsDetails = [
    publicChannels.error ? `channels: ${publicChannels.error.message}` : "active channels readable",
    publicPlayableSongs.error ? `songs: ${publicPlayableSongs.error.message}` : `playable songs readable: ${(publicPlayableSongs.data ?? []).length}`,
    publicAssignments.error ? `assignments: ${publicAssignments.error.message}` : "joined public assignments readable",
    profilesRestricted ? "admin_profiles restricted" : "admin_profiles exposed rows",
    takedownsRestricted ? "takedown_requests restricted" : "takedown_requests exposed rows",
    importQueueRestricted ? "youtube_import_queue restricted" : "youtube_import_queue exposed rows",
    presenceRestricted ? "active_listener_sessions restricted" : "active_listener_sessions exposed rows",
  ].join("; ");
  const rlsOk = publicChannelOk && publicPlayableSongsOk && publicAssignmentsOk && profilesRestricted && takedownsRestricted && importQueueRestricted && presenceRestricted;
  if (!rlsOk) failures += 1;
  reportLine("public RLS behavior", rlsOk, rlsDetails);

  const latestImportedSong = (publicPlayableSongs.data ?? []).sort((a, b) => String(b.id).localeCompare(String(a.id)))[0];
  reportLine("at least one imported playable public song", publicPlayableSongsOk, latestImportedSong ? `sample: ${latestImportedSong.title} (${latestImportedSong.youtube_video_id})` : "no active available songs visible to anon");
  reportLine("at least one valid joined public catalogue record", publicAssignmentsOk, publicAssignments.error?.message);

  if (!fs.existsSync(path.join(process.cwd(), "supabase", "config.toml"))) {
    console.log("INFO Supabase CLI project link: no supabase/config.toml found; run manual link commands before db push/list.");
  } else {
    console.log("INFO Supabase CLI project link: supabase/config.toml found.");
  }

  if (failures > 0) {
    console.log(`Verification finished with ${failures} failure(s).`);
    process.exitCode = 1;
  } else {
    console.log("Verification finished successfully.");
  }
}

main().catch((error) => {
  console.error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
