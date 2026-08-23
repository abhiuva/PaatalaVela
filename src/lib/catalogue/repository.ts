import "server-only";

import { getChannelBySlug, getChannelForHour } from "@/lib/schedule";
import { createPublicSupabaseServerClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { getLocalCatalogue } from "@/lib/catalogue/local";
import { buildSupabaseCatalogue, buildSupabaseChannel, type ChannelWithSongs } from "@/lib/catalogue/remote";
import { isLockedChannelSlug } from "@/lib/catalogue/validation";
import { isUuid } from "@/lib/validation/uuid";
import type { PublicCatalogue } from "@/lib/catalogue/types";
import type { EmbedStatus } from "@/types/database";

export class CatalogueRepository {
  async getChannelById(channelId: string) {
    if (!isUuid(channelId)) {
      return { channel: null, error: "invalid_id" as const };
    }

    const supabase = createPublicSupabaseServerClient();
    if (!supabase) {
      return { channel: null, error: "configuration" as const };
    }

    const { data, error } = await supabase
      .from("channels")
      .select("*, channel_songs(*, songs(*, song_moods(mood_code), song_occasions(occasion_code)))")
      .eq("id", channelId)
      .eq("active", true)
      .eq("channel_songs.active", true)
      .order("sequence", { referencedTable: "channel_songs", ascending: true })
      .order("created_at", { referencedTable: "channel_songs", ascending: true })
      .maybeSingle();

    if (error) {
      return { channel: null, error: "query" as const };
    }

    if (!data) {
      return { channel: null, error: "not_found" as const };
    }

    const channel = buildSupabaseChannel(data as ChannelWithSongs);
    return channel
      ? { channel, error: null }
      : { channel: null, error: "invalid_channel" as const };
  }

  async getActiveChannels(): Promise<PublicCatalogue> {
    const supabase = createPublicSupabaseServerClient();

    if (!supabase) {
      return getLocalCatalogue("Supabase environment variables are not configured. Local read-only fallback is active.", "CATALOGUE_CONFIG_MISSING");
    }

    const { data, error } = await supabase
      .from("channels")
      .select("*, channel_songs(*, songs(*, song_moods(mood_code), song_occasions(occasion_code)))")
      .eq("active", true)
      .eq("channel_songs.active", true)
      .order("display_order", { ascending: true })
      .order("sequence", { referencedTable: "channel_songs", ascending: true })
      .order("created_at", { referencedTable: "channel_songs", ascending: true });

    if (error || !data) {
      const denied = error?.code === "42501" || /permission|rls|row-level/i.test(error?.message ?? "");
      return getLocalCatalogue(
        denied ? "Supabase catalogue read was denied by RLS. Local read-only fallback is active." : "Supabase catalogue request failed. Local read-only fallback is active.",
        denied ? "CATALOGUE_RLS_DENIED" : "CATALOGUE_QUERY_FAILED",
      );
    }

    return buildSupabaseCatalogue(data as ChannelWithSongs[]);
  }

  async getCurrentChannel(indiaTime: Date) {
    const catalogue = await this.getActiveChannels();
    return getChannelForHour(indiaTime.getHours(), catalogue.channels);
  }

  async getSongsForChannel(channelSlug: string) {
    const catalogue = await this.getActiveChannels();
    if (!isLockedChannelSlug(channelSlug)) {
      return [];
    }
    return getChannelBySlug(channelSlug, catalogue.channels).songs;
  }

  async getSongById(songId: string) {
    const catalogue = await this.getActiveChannels();
    return catalogue.channels.flatMap((channel) => channel.songs).find((song) => song.id === songId) ?? null;
  }

  async getNextPlayableSong(channelSlug: string, currentSongId: string) {
    const songs = await this.getSongsForChannel(channelSlug);
    if (songs.length === 0) {
      return null;
    }

    const currentIndex = songs.findIndex((song) => song.id === currentSongId);
    return songs[(currentIndex + 1 + songs.length) % songs.length];
  }

  async reportUnavailableSong(songId: string, status: Exclude<EmbedStatus, "unchecked" | "available">) {
    const supabase = createServiceSupabaseClient();
    if (!supabase) {
      return { ok: false, message: "Supabase service role is not configured." };
    }

    const { error } = await supabase
      .from("songs")
      .update({ embed_status: status, last_checked_at: new Date().toISOString() })
      .eq("id", songId);

    return error ? { ok: false, message: "Unable to update song status." } : { ok: true, message: "Song status updated." };
  }
}

export const catalogueRepository = new CatalogueRepository();
