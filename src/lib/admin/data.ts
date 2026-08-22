import "server-only";

import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { DbAdminProfile, DbChannel, DbChannelSong, DbSong, DbTakedownRequest, DbYouTubeImportQueue } from "@/types/database";

export type AdminAssignment = DbChannelSong & {
  channels: Pick<DbChannel, "id" | "name" | "slug"> | null;
  songs: Pick<DbSong, "id" | "title" | "youtube_video_id" | "active" | "embed_status" | "duration_seconds"> | null;
};

export type AdminSong = DbSong & {
  song_moods: Array<{ mood_code: string }>;
  song_occasions: Array<{ occasion_code: string }>;
};

export type AdminDashboardData = {
  channels: DbChannel[];
  songs: AdminSong[];
  assignments: AdminAssignment[];
  takedowns: DbTakedownRequest[];
  profiles: DbAdminProfile[];
  youtubeImportQueue: DbYouTubeImportQueue[];
  youtubeCheckerConfigured: boolean;
};

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return {
      channels: [],
      songs: [],
      assignments: [],
      takedowns: [],
      profiles: [],
      youtubeImportQueue: [],
      youtubeCheckerConfigured: false,
    };
  }

  const [channels, songs, assignments, takedowns, profiles, youtubeImportQueue] = await Promise.all([
    supabase.from("channels").select("*").order("display_order", { ascending: true }),
    supabase.from("songs").select("*, song_moods(mood_code), song_occasions(occasion_code)").order("created_at", { ascending: false }),
    supabase
      .from("channel_songs")
      .select("*, channels(id, name, slug), songs(id, title, youtube_video_id, active, embed_status, duration_seconds)")
      .order("sequence", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("takedown_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("admin_profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("youtube_import_queue").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  return {
    channels: channels.data ?? [],
    songs: (songs.data ?? []) as AdminSong[],
    assignments: (assignments.data ?? []) as AdminAssignment[],
    takedowns: takedowns.data ?? [],
    profiles: profiles.data ?? [],
    youtubeImportQueue: youtubeImportQueue.data ?? [],
    youtubeCheckerConfigured: Boolean(process.env.YOUTUBE_API_KEY),
  };
}
