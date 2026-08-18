import { describe, expect, it } from "vitest";
import { calculateLivePlaybackPosition, getElapsedChannelSeconds } from "@/lib/radio/live-position";
import type { QueueItem } from "@/lib/radio/queue";

const songs: QueueItem[] = [
  {
    id: "s1",
    title: "Song 1",
    film: "Film",
    year: 2000,
    singers: ["Singer"],
    composer: "Composer",
    youtubeVideoId: "dQw4w9WgXcQ",
    durationSeconds: 100,
    sequence: 10,
    assignmentCreatedAt: "2026-01-01T00:00:00.000Z",
    placeholder: false,
  },
  {
    id: "s2",
    title: "Song 2",
    film: "Film",
    year: 2000,
    singers: ["Singer"],
    composer: "Composer",
    youtubeVideoId: "M7lc1UVf-VE",
    durationSeconds: 200,
    sequence: 20,
    assignmentCreatedAt: "2026-01-01T00:00:00.000Z",
    placeholder: false,
  },
];

function istDate(isoWithOffset: string) {
  return new Date(isoWithOffset);
}

describe("calculateLivePlaybackPosition", () => {
  it("selects song 1 at channel start", () => {
    const position = calculateLivePlaybackPosition({
      currentTime: istDate("2026-08-15T09:00:00+05:30"),
      channelStartHour: 9,
      songs,
    });

    expect(position.songId).toBe("s1");
    expect(position.seekSeconds).toBe(0);
  });

  it("returns the correct seek during song 1", () => {
    const position = calculateLivePlaybackPosition({
      currentTime: istDate("2026-08-15T09:01:15+05:30"),
      channelStartHour: 9,
      songs,
    });

    expect(position.songId).toBe("s1");
    expect(position.seekSeconds).toBe(75);
  });

  it("moves to song 2 at the exact end of song 1", () => {
    const position = calculateLivePlaybackPosition({
      currentTime: istDate("2026-08-15T09:01:40+05:30"),
      channelStartHour: 9,
      songs,
    });

    expect(position.songId).toBe("s2");
    expect(position.seekSeconds).toBe(0);
  });

  it("loops to song 1 at the exact end of the playlist", () => {
    const position = calculateLivePlaybackPosition({
      currentTime: istDate("2026-08-15T09:05:00+05:30"),
      channelStartHour: 9,
      songs,
    });

    expect(position.songId).toBe("s1");
    expect(position.seekSeconds).toBe(0);
    expect(position.playlistCycle).toBe(1);
  });

  it("calculates multiple playlist cycles", () => {
    const position = calculateLivePlaybackPosition({
      currentTime: istDate("2026-08-15T09:13:20+05:30"),
      channelStartHour: 9,
      songs,
    });

    expect(position.playlistCycle).toBe(2);
    expect(position.songId).toBe("s2");
    expect(position.seekSeconds).toBe(100);
  });

  it("handles Highway Ratri after midnight", () => {
    expect(getElapsedChannelSeconds(istDate("2026-08-16T01:15:00+05:30"), 23)).toBe(8100);
  });

  it("handles Highway Ratri before midnight", () => {
    expect(getElapsedChannelSeconds(istDate("2026-08-15T23:30:00+05:30"), 23)).toBe(1800);
  });

  it("is independent of device timezone representation", () => {
    const sameMoment = new Date(Date.UTC(2026, 7, 15, 3, 30, 0));
    expect(getElapsedChannelSeconds(sameMoment, 9)).toBe(0);
  });
});
