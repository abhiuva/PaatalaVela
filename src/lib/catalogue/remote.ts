import { channels as localChannels } from "@/data/channels";
import { isPublicPlayableSong } from "@/lib/catalogue/public-filter";
import { isLockedChannelSlug } from "@/lib/catalogue/validation";
import type { PublicCatalogue } from "@/lib/catalogue/types";
import type { DbChannel, DbChannelSong, DbSong } from "@/types/database";
import type { Channel, Song } from "@/types/radio";

export type ChannelSongJoin = DbChannelSong & {
  songs: DbSong | null;
};

export type ChannelWithSongs = DbChannel & {
  channel_songs: ChannelSongJoin[] | null;
};

function toChannel(row: ChannelWithSongs): Channel | null {
  if (!isLockedChannelSlug(row.slug)) {
    return null;
  }

  const local = localChannels.find((channel) => channel.id === row.slug);
  const songs = (row.channel_songs ?? [])
    .filter((assignment) => assignment.active && assignment.songs)
    .sort(
      (a, b) =>
        a.sequence - b.sequence ||
        a.created_at.localeCompare(b.created_at) ||
        (a.songs?.id ?? "").localeCompare(b.songs?.id ?? ""),
    )
    .map((assignment): Song | null => {
      const song = assignment.songs;
      if (!song || !isPublicPlayableSong(song.active, song.embed_status)) {
        return null;
      }

      if (!song.title || !song.film || !song.composer || !song.youtube_video_id || song.singers.length === 0) {
        return null;
      }

      return {
        id: song.id,
        title: song.title,
        film: song.film,
        year: song.release_year,
        singers: song.singers,
        composer: song.composer,
        youtubeVideoId: song.youtube_video_id,
        durationSeconds: song.duration_seconds,
        sequence: assignment.sequence,
        assignmentCreatedAt: assignment.created_at,
        active: song.active,
        embedStatus: song.embed_status,
        placeholder: false,
      };
    })
    .filter((song): song is Song => Boolean(song));

  return {
    id: row.slug,
    name: row.name,
    teluguName: row.telugu_name,
    strapline: row.positioning,
    mood: local?.mood ?? row.positioning,
    schedule: {
      startHour: row.start_hour,
      endHour: row.end_hour,
    },
    palette: {
      from: row.primary_color,
      via: row.secondary_color,
      to: local?.palette.to ?? row.secondary_color,
      accent: row.accent_color,
    },
    songs,
  };
}

function validateChannelShell(channels: Channel[]) {
  if (channels.length !== 6) {
    return false;
  }

  return localChannels.every((local) => {
    const channel = channels.find((item) => item.id === local.id);
    return channel && channel.schedule.startHour === local.schedule.startHour && channel.schedule.endHour === local.schedule.endHour;
  });
}

function hasJoinedAssignments(channels: Channel[]) {
  return channels.some((channel) => channel.songs.length > 0);
}

export function buildSupabaseCatalogue(rows: ChannelWithSongs[]): PublicCatalogue {
  const channels = rows.map(toChannel).filter((channel): channel is Channel => Boolean(channel));

  if (!validateChannelShell(channels)) {
    return {
      channels,
      source: "supabase",
      fallbackReason: "Active Supabase channels are missing or do not match the locked schedule.",
      diagnosticCode: "ACTIVE_CHANNELS_MISSING",
    };
  }

  return {
    channels,
    source: "supabase",
    diagnosticCode: hasJoinedAssignments(channels) ? undefined : "CHANNEL_EMPTY",
  };
}
