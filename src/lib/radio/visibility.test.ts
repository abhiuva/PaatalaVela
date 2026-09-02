import { describe, expect, it } from "vitest";
import { resolveLiveVisibilityDecision } from "@/lib/radio/visibility";
import type { Channel, Song } from "@/types/radio";

function song(id: string, sequence: number): Song {
  return {
    id: `00000000-0000-4000-8000-${id.padStart(12, "0")}`,
    assignmentId: `10000000-0000-4000-8000-${id.padStart(12, "0")}`,
    channelId: "20000000-0000-4000-8000-000000000001",
    title: id,
    film: "Film",
    year: 2024,
    singers: ["Singer"],
    composer: "Composer",
    thumbnailUrl: null,
    story: null,
    context: null,
    languageCode: "te",
    eraCode: "2020s",
    moods: [],
    occasions: [],
    youtubeVideoId: id.padEnd(11, "x").slice(0, 11),
    durationSeconds: 100,
    sequence,
    assignmentCreatedAt: "2026-01-01T00:00:00Z",
    active: true,
    embedStatus: "available",
  };
}

function channel(id: string, slug: string, songs: Song[]): Channel {
  return {
    id,
    slug,
    mode: "scheduled",
    scheduled: true,
    languageCode: "te",
    name: slug,
    teluguName: slug,
    strapline: slug,
    mood: slug,
    backgroundImageUrl: null,
    schedule: { startHour: 5, endHour: 9 },
    palette: { from: "#000000", via: "#111111", to: "#222222", accent: "#ffffff" },
    songs,
  };
}

const scheduled = channel("20000000-0000-4000-8000-000000000001", "scheduled", [song("1", 1), song("2", 2), song("3", 3)]);

describe("scheduled visibility reconciliation", () => {
  it("does nothing when the same entry remains within drift tolerance", () => {
    expect(resolveLiveVisibilityDecision({
      scheduledChannel: scheduled,
      selectedChannel: scheduled,
      currentQueueEntryId: scheduled.songs[0].assignmentId!,
      currentPositionSeconds: 47,
      currentTime: new Date("2026-09-02T05:00:50+05:30"),
      driftToleranceSeconds: 5,
    })).toEqual({ type: "unchanged", driftSeconds: 3, seekSeconds: 50 });
  });

  it("seeks without switching when a suspended same entry has material drift", () => {
    expect(resolveLiveVisibilityDecision({
      scheduledChannel: scheduled,
      selectedChannel: scheduled,
      currentQueueEntryId: scheduled.songs[0].assignmentId!,
      currentPositionSeconds: 20,
      currentTime: new Date("2026-09-02T05:00:50+05:30"),
      driftToleranceSeconds: 5,
    })).toEqual({ type: "seek", driftSeconds: 30, seekSeconds: 50 });
  });

  it("switches once to the authoritative entry and offset after a long suspension", () => {
    expect(resolveLiveVisibilityDecision({
      scheduledChannel: scheduled,
      selectedChannel: scheduled,
      currentQueueEntryId: scheduled.songs[0].assignmentId!,
      currentPositionSeconds: 90,
      currentTime: new Date("2026-09-02T05:01:45+05:30"),
      driftToleranceSeconds: 5,
    })).toEqual({
      type: "switch",
      driftSeconds: null,
      seekSeconds: 5,
      channelId: scheduled.id,
      queueEntryId: scheduled.songs[1].assignmentId,
    });
  });

  it("switches when the scheduled channel legitimately changes", () => {
    const oldChannel = channel("20000000-0000-4000-8000-000000000002", "old", [song("9", 1)]);
    expect(resolveLiveVisibilityDecision({
      scheduledChannel: scheduled,
      selectedChannel: oldChannel,
      currentQueueEntryId: oldChannel.songs[0].assignmentId!,
      currentPositionSeconds: 20,
      currentTime: new Date("2026-09-02T05:00:50+05:30"),
      driftToleranceSeconds: 5,
    }).type).toBe("switch");
  });
});
