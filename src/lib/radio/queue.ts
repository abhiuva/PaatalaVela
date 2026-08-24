import type { Channel, Song } from "@/types/radio";

export type PlaybackMode = "live" | "manual";

export type QueueWarning = {
  type: "duplicate_sequence" | "missing_duration" | "empty_queue";
  message: string;
  songId?: string;
  sequence?: number;
};

export type QueueItem = Song & {
  assignmentId: string;
  channelId: string | null;
  durationSeconds: number;
  sequence: number;
  assignmentCreatedAt: string;
};

export type ChannelQueue = {
  channelSlug: string;
  items: readonly QueueItem[];
  warnings: readonly QueueWarning[];
};

function isAvailable(song: Song) {
  return song.active !== false && !["unavailable", "embedding_disabled", "region_restricted"].includes(song.embedStatus ?? "available");
}

export function buildChannelQueue(channel: Channel, mode: PlaybackMode = "live"): ChannelQueue {
  const warnings: QueueWarning[] = [];
  const sequenceCounts = new Map<number, number>();
  const seenSongIds = new Set<string>();

  channel.songs.forEach((song, index) => {
    const sequence = song.sequence ?? (index + 1) * 10;
    sequenceCounts.set(sequence, (sequenceCounts.get(sequence) ?? 0) + 1);
    if (!song.durationSeconds || song.durationSeconds <= 0) {
      warnings.push({
        type: "missing_duration",
        songId: song.id,
        sequence,
        message: `${song.title} is missing a valid duration.`,
      });
    }
  });

  sequenceCounts.forEach((count, sequence) => {
    if (count > 1) {
      warnings.push({
        type: "duplicate_sequence",
        sequence,
        message: `Sequence ${sequence} is assigned to ${count} songs.`,
      });
    }
  });

  const items = channel.songs
    .map((song, index) => ({
      ...song,
      assignmentId: song.assignmentId ?? `${channel.id ?? channel.slug}:${song.id}`,
      channelId: song.channelId ?? channel.id,
      durationSeconds: song.durationSeconds ?? 0,
      sequence: song.sequence ?? (index + 1) * 10,
      assignmentCreatedAt: song.assignmentCreatedAt ?? "1970-01-01T00:00:00.000Z",
    }))
    .filter((song) => isAvailable(song))
    .filter((song) => mode === "manual" || song.durationSeconds > 0)
    .sort((a, b) => a.sequence - b.sequence || a.assignmentCreatedAt.localeCompare(b.assignmentCreatedAt) || a.id.localeCompare(b.id))
    .filter((song) => {
      if (seenSongIds.has(song.id)) {
        return false;
      }
      seenSongIds.add(song.id);
      return true;
    });

  if (items.length === 0) {
    warnings.push({
      type: "empty_queue",
      message: `${channel.name} has no playable songs for ${mode} mode.`,
    });
  }

  return {
    channelSlug: channel.slug,
    items: Object.freeze(items.map((item) => Object.freeze(item))),
    warnings: Object.freeze(warnings),
  };
}

export function getNextQueueIndex(queueLength: number, currentIndex: number, direction: 1 | -1) {
  if (queueLength <= 0) {
    return 0;
  }

  return (currentIndex + direction + queueLength) % queueLength;
}

export function getQueueIndexByAssignmentId(items: readonly QueueItem[], assignmentId: string | null) {
  if (!assignmentId) return -1;
  return items.findIndex((item) => item.assignmentId === assignmentId);
}

export function getAdjacentQueueIndex(items: readonly QueueItem[], currentAssignmentId: string | null, direction: 1 | -1) {
  const currentIndex = getQueueIndexByAssignmentId(items, currentAssignmentId);
  return getNextQueueIndex(items.length, currentIndex >= 0 ? currentIndex : 0, direction);
}
