import { describe, expect, it } from "vitest";
import { buildChannelQueue } from "@/lib/radio/queue";
import type { Channel } from "@/types/radio";

function channel(songs: Channel["songs"]): Channel {
  return {
    id: null,
    slug: "tea-shop-classics",
    scheduled: true,
    name: "Tea Shop Classics",
    teluguName: "టీ షాప్ క్లాసిక్స్",
    strapline: "Test",
    mood: "Test",
    schedule: { startHour: 9, endHour: 13 },
    palette: { from: "#000000", via: "#111111", to: "#222222", accent: "#ffffff" },
    songs,
  };
}

const baseSong = {
  title: "Song",
  film: "Film",
  year: 2000,
  singers: ["Singer"],
  composer: "Composer",
  youtubeVideoId: "dQw4w9WgXcQ",
  durationSeconds: 100,
};

describe("buildChannelQueue", () => {
  it("orders songs by sequence", () => {
    const queue = buildChannelQueue(
      channel([
        { ...baseSong, id: "b", sequence: 20 },
        { ...baseSong, id: "a", sequence: 10 },
      ]),
    );

    expect(queue.items.map((song) => song.id)).toEqual(["a", "b"]);
  });

  it("removes inactive and unavailable songs", () => {
    const queue = buildChannelQueue(
      channel([
        { ...baseSong, id: "a", sequence: 10, active: false },
        { ...baseSong, id: "b", sequence: 20, embedStatus: "unavailable" },
        { ...baseSong, id: "c", sequence: 30, embedStatus: "available" },
      ]),
    );

    expect(queue.items.map((song) => song.id)).toEqual(["c"]);
  });

  it("excludes missing durations from live mode but not manual mode", () => {
    const fixture = channel([
      { ...baseSong, id: "a", sequence: 10, durationSeconds: null },
      { ...baseSong, id: "b", sequence: 20, durationSeconds: 120 },
    ]);

    expect(buildChannelQueue(fixture, "live").items.map((song) => song.id)).toEqual(["b"]);
    expect(buildChannelQueue(fixture, "manual").items.map((song) => song.id)).toEqual(["a", "b"]);
  });

  it("removes duplicate song IDs after stable sorting", () => {
    const queue = buildChannelQueue(
      channel([
        { ...baseSong, id: "a", sequence: 20 },
        { ...baseSong, id: "a", sequence: 10 },
      ]),
    );

    expect(queue.items.map((song) => song.sequence)).toEqual([10]);
  });

  it("uses stable tie-breakers for equal sequence values", () => {
    const queue = buildChannelQueue(
      channel([
        { ...baseSong, id: "c", sequence: 10, assignmentCreatedAt: "2026-01-01T00:00:02.000Z" },
        { ...baseSong, id: "a", sequence: 10, assignmentCreatedAt: "2026-01-01T00:00:01.000Z" },
        { ...baseSong, id: "b", sequence: 10, assignmentCreatedAt: "2026-01-01T00:00:01.000Z" },
      ]),
    );

    expect(queue.items.map((song) => song.id)).toEqual(["a", "b", "c"]);
    expect(queue.warnings.some((warning) => warning.type === "duplicate_sequence")).toBe(true);
  });

  it("never mutates input and is stable across repeated calls", () => {
    const input = channel([
      { ...baseSong, id: "b", sequence: 20 },
      { ...baseSong, id: "a", sequence: 10 },
    ]);
    const before = JSON.stringify(input);

    const first = buildChannelQueue(input);
    const second = buildChannelQueue(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(first.items.map((song) => song.id)).toEqual(second.items.map((song) => song.id));
  });
});
