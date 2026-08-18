import { describe, expect, it } from "vitest";
import { channels as localChannels } from "@/data/channels";
import { buildSupabaseCatalogue, type ChannelWithSongs } from "@/lib/catalogue/remote";
import type { DbSong } from "@/types/database";

const baseSong: DbSong = {
  id: "song-1",
  title: "Imported Song",
  telugu_title: null,
  film: "Film",
  release_year: 2024,
  singers: ["Singer"],
  composer: "Composer",
  lyricist: null,
  youtube_video_id: "BYW6drVxOIA",
  youtube_url: "https://www.youtube.com/watch?v=BYW6drVxOIA",
  duration_seconds: 179,
  spotify_url: null,
  youtube_music_url: null,
  editorial_note: null,
  editorial_note_telugu: null,
  thumbnail_url: null,
  embed_status: "available",
  last_checked_at: null,
  active: true,
  created_at: "2026-08-18T00:00:00.000Z",
  updated_at: "2026-08-18T00:00:00.000Z",
};

function channelRow(slug: string, index: number, songs: DbSong[] = []): ChannelWithSongs {
  const local = localChannels[index];
  return {
    id: `channel-${index}`,
    slug,
    name: local.name,
    telugu_name: local.teluguName,
    positioning: local.strapline,
    start_hour: local.schedule.startHour,
    end_hour: local.schedule.endHour,
    background_image_url: null,
    primary_color: local.palette.from,
    secondary_color: local.palette.via,
    accent_color: local.palette.accent,
    display_order: index + 1,
    active: true,
    created_at: "2026-08-18T00:00:00.000Z",
    updated_at: "2026-08-18T00:00:00.000Z",
    channel_songs: songs.map((song, songIndex) => ({
      id: `assignment-${index}-${songIndex}`,
      channel_id: `channel-${index}`,
      song_id: song.id,
      sequence: songIndex + 1,
      weight: 1,
      active: true,
      created_at: `2026-08-18T00:00:0${songIndex}.000Z`,
      songs: song,
    })),
  };
}

function allChannelRows(songChannelIndex = 1, song: DbSong | null = baseSong) {
  return localChannels.map((channel, index) => channelRow(channel.id, index, song && index === songChannelIndex ? [song] : []));
}

describe("Supabase public catalogue mapping", () => {
  it("returns an imported playable song from the public catalogue response", () => {
    const catalogue = buildSupabaseCatalogue(allChannelRows());
    const teaShop = catalogue.channels.find((channel) => channel.id === "tea-shop-classics");

    expect(catalogue.source).toBe("supabase");
    expect(catalogue.fallbackReason).toBeUndefined();
    expect(teaShop?.songs).toHaveLength(1);
    expect(teaShop?.songs[0]).toMatchObject({
      title: "Imported Song",
      youtubeVideoId: "BYW6drVxOIA",
      placeholder: false,
      embedStatus: "available",
    });
  });

  it("keeps an empty selected channel empty instead of activating global fallback", () => {
    const catalogue = buildSupabaseCatalogue(allChannelRows());
    const suprabhata = catalogue.channels.find((channel) => channel.id === "suprabhata-melodies");

    expect(catalogue.source).toBe("supabase");
    expect(catalogue.fallbackReason).toBeUndefined();
    expect(suprabhata?.songs).toEqual([]);
  });

  it("does not mark valid Supabase response as fallback when only some channels have songs", () => {
    const catalogue = buildSupabaseCatalogue(allChannelRows());

    expect(catalogue.source).toBe("supabase");
    expect(catalogue.channels.filter((channel) => channel.songs.length > 0)).toHaveLength(1);
    expect(catalogue.diagnosticCode).toBeUndefined();
  });

  it("classifies a valid but fully empty Supabase catalogue without local fallback", () => {
    const catalogue = buildSupabaseCatalogue(allChannelRows(1, null));

    expect(catalogue.source).toBe("supabase");
    expect(catalogue.diagnosticCode).toBe("CHANNEL_EMPTY");
    expect(catalogue.channels.every((channel) => channel.songs.length === 0)).toBe(true);
  });

  it("filters unavailable or inactive songs without using placeholders", () => {
    const unavailable = { ...baseSong, id: "song-2", active: true, embed_status: "unchecked" as const };
    const catalogue = buildSupabaseCatalogue(allChannelRows(1, unavailable));

    expect(catalogue.source).toBe("supabase");
    expect(catalogue.channels.flatMap((channel) => channel.songs)).toEqual([]);
  });
});
