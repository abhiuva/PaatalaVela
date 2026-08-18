import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSupportedVideoInput,
  getNextSequence,
  iso8601DurationToSeconds,
  mapVideoItemToMetadata,
  parseYouTubePlaylistInput,
  parseYouTubeVideoInput,
  queueStatusForMetadata,
} from "@/lib/youtube/import";

describe("YouTube import helpers", () => {
  it("supports standard, short, shorts, embed and raw video inputs", () => {
    expect(parseYouTubeVideoInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoInput("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoInput("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoInput("https://youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoInput("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects invalid video input", () => {
    expect(() => assertSupportedVideoInput("https://example.com/watch?v=dQw4w9WgXcQ")).toThrow("Unsupported YouTube input");
  });

  it("parses playlist URLs and raw playlist IDs", () => {
    expect(parseYouTubePlaylistInput("https://www.youtube.com/playlist?list=PL1234567890")).toBe("PL1234567890");
    expect(parseYouTubePlaylistInput("PL1234567890")).toBe("PL1234567890");
  });

  it("converts ISO 8601 durations", () => {
    expect(iso8601DurationToSeconds("PT3M15S")).toBe(195);
    expect(iso8601DurationToSeconds("PT1H2M3S")).toBe(3723);
    expect(iso8601DurationToSeconds("P1DT2S")).toBe(86402);
  });

  it("maps metadata autofill and embeddability", () => {
    const metadata = mapVideoItemToMetadata({
      id: "dQw4w9WgXcQ",
      snippet: {
        title: "Telugu Song | Film: Demo | Singer: SPB | Music: Composer | Lyricist: Writer | 1999",
        description: "Film: Demo\nSingers: SPB\nComposer: Composer\nLyricist: Writer",
        channelTitle: "Official Channel",
        publishedAt: "2020-01-02T00:00:00Z",
        thumbnails: { high: { url: "https://i.ytimg.com/demo.jpg" } },
      },
      contentDetails: { duration: "PT4M" },
      status: { embeddable: true, privacyStatus: "public", uploadStatus: "processed" },
    });

    expect(metadata.durationSeconds).toBe(240);
    expect(metadata.uploader).toBe("Official Channel");
    expect(metadata.availability).toBe("available");
    expect(metadata.suggestions.film).toBe("Demo");
    expect(metadata.suggestions.releaseYear).toBe("1999");
  });

  it("marks private and non-embeddable videos", () => {
    expect(mapVideoItemToMetadata({ id: "dQw4w9WgXcQ", status: { privacyStatus: "private", embeddable: false } }).availability).toBe("private");
    expect(mapVideoItemToMetadata({ id: "dQw4w9WgXcQ", status: { privacyStatus: "public", embeddable: false } }).availability).toBe("embedding_disabled");
  });

  it("calculates the next sequence from active assignments", () => {
    expect(getNextSequence([{ sequence: 10, active: true }, { sequence: 20, active: true }, { sequence: 100, active: false }])).toBe(21);
  });

  it("detects duplicate and unavailable queue statuses", () => {
    expect(queueStatusForMetadata("song-1", { availability: "available", embeddable: true })).toBe("duplicate");
    expect(queueStatusForMetadata(null, { availability: "private", embeddable: false })).toBe("unavailable");
    expect(queueStatusForMetadata(null, { availability: "available", embeddable: true })).toBe("pending");
  });

  it("keeps playlist retrieval paginated in the server helper", () => {
    const serverSource = readFileSync(path.join(process.cwd(), "src/lib/youtube/server.ts"), "utf8");
    expect(serverSource).toContain("nextPageToken");
    expect(serverSource).toContain("pageToken");
  });
});
