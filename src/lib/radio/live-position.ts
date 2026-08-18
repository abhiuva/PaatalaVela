import { INDIA_TIME_ZONE } from "@/lib/schedule";
import type { QueueItem } from "@/lib/radio/queue";

export type LivePlaybackPosition = {
  songIndex: number;
  songId: string;
  seekSeconds: number;
  elapsedChannelSeconds: number;
  playlistCycle: number;
  totalPlaylistDuration: number;
};

function getIndiaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour === "24" ? "0" : values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function wallClockEpochSeconds(parts: ReturnType<typeof getIndiaParts>) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) / 1000);
}

export function getElapsedChannelSeconds(currentTime: Date, channelStartHour: number) {
  const current = getIndiaParts(currentTime);
  const currentEpoch = wallClockEpochSeconds(current);
  let startEpoch = wallClockEpochSeconds({ ...current, hour: channelStartHour, minute: 0, second: 0 });

  if (channelStartHour > current.hour) {
    startEpoch -= 24 * 60 * 60;
  }

  return Math.max(0, currentEpoch - startEpoch);
}

export function calculateLivePlaybackPosition({
  currentTime,
  channelStartHour,
  songs,
}: {
  currentTime: Date;
  channelStartHour: number;
  songs: readonly QueueItem[];
}): LivePlaybackPosition {
  if (songs.length === 0) {
    throw new Error("Cannot calculate live position for an empty queue.");
  }

  const totalPlaylistDuration = songs.reduce((total, song) => total + song.durationSeconds, 0);
  if (totalPlaylistDuration <= 0) {
    throw new Error("Cannot calculate live position without positive song durations.");
  }

  const elapsedChannelSeconds = getElapsedChannelSeconds(currentTime, channelStartHour);
  const positionInPlaylist = elapsedChannelSeconds % totalPlaylistDuration;
  const playlistCycle = Math.floor(elapsedChannelSeconds / totalPlaylistDuration);
  let cursor = 0;

  for (let index = 0; index < songs.length; index += 1) {
    const nextCursor = cursor + songs[index].durationSeconds;
    if (positionInPlaylist < nextCursor) {
      return {
        songIndex: index,
        songId: songs[index].id,
        seekSeconds: positionInPlaylist - cursor,
        elapsedChannelSeconds,
        playlistCycle,
        totalPlaylistDuration,
      };
    }
    cursor = nextCursor;
  }

  return {
    songIndex: 0,
    songId: songs[0].id,
    seekSeconds: 0,
    elapsedChannelSeconds,
    playlistCycle,
    totalPlaylistDuration,
  };
}
