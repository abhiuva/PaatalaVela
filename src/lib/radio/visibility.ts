import { calculateLivePlaybackPosition } from "@/lib/radio/live-position";
import { buildChannelQueue } from "@/lib/radio/queue";
import type { Channel } from "@/types/radio";

export type LiveVisibilityDecision =
  | { type: "unchanged"; driftSeconds: number; seekSeconds: number }
  | { type: "seek"; driftSeconds: number; seekSeconds: number }
  | { type: "switch"; driftSeconds: null; seekSeconds: number; channelId: string | null; queueEntryId: string };

export function resolveLiveVisibilityDecision({
  scheduledChannel,
  selectedChannel,
  currentQueueEntryId,
  currentPositionSeconds,
  currentTime,
  driftToleranceSeconds,
}: {
  scheduledChannel: Channel;
  selectedChannel: Channel;
  currentQueueEntryId: string | null;
  currentPositionSeconds: number;
  currentTime: Date;
  driftToleranceSeconds: number;
}): LiveVisibilityDecision {
  const queue = buildChannelQueue(scheduledChannel, "live");
  if (queue.items.length === 0) {
    return { type: "unchanged", driftSeconds: 0, seekSeconds: Math.max(0, currentPositionSeconds) };
  }

  const position = calculateLivePlaybackPosition({
    currentTime,
    channelStartHour: scheduledChannel.schedule.startHour,
    songs: queue.items,
  });
  const authoritativeEntry = queue.items[position.songIndex];
  if (scheduledChannel.id !== selectedChannel.id || authoritativeEntry.assignmentId !== currentQueueEntryId) {
    return {
      type: "switch",
      driftSeconds: null,
      seekSeconds: position.seekSeconds,
      channelId: scheduledChannel.id,
      queueEntryId: authoritativeEntry.assignmentId,
    };
  }

  const driftSeconds = Math.abs(position.seekSeconds - currentPositionSeconds);
  return driftSeconds > driftToleranceSeconds
    ? { type: "seek", driftSeconds, seekSeconds: position.seekSeconds }
    : { type: "unchanged", driftSeconds, seekSeconds: position.seekSeconds };
}
