import { describe, expect, it } from "vitest";
import { getAdjacentQueueIndex, type QueueItem } from "@/lib/radio/queue";

function item(assignmentId: string, id: string, sequence: number, youtubeVideoId = "aaaaaaaaaaa"): QueueItem {
  return {
    assignmentId,
    channelId: "channel-id",
    id,
    sequence,
    youtubeVideoId,
    title: id,
    film: "",
    year: 2020,
    singers: [],
    composer: "",
    thumbnailUrl: null,
    story: null,
    context: null,
    languageCode: "te",
    eraCode: "2020s",
    moods: [],
    occasions: [],
    durationSeconds: 100,
    assignmentCreatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("queue assignment identity", () => {
  const items = [
    item("assignment-1", "song-1", 1, "samevideo01"),
    item("assignment-2", "song-2", 1, "samevideo01"),
    item("assignment-3", "song-3", 2, "different01"),
  ];

  it("advances by assignment identity despite duplicate sequence and video IDs", () => {
    expect(getAdjacentQueueIndex(items, "assignment-1", 1)).toBe(1);
    expect(getAdjacentQueueIndex(items, "assignment-2", 1)).toBe(2);
  });

  it("wraps in both directions", () => {
    expect(getAdjacentQueueIndex(items, "assignment-3", 1)).toBe(0);
    expect(getAdjacentQueueIndex(items, "assignment-1", -1)).toBe(2);
  });
});
