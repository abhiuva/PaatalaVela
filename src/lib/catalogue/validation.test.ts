import { describe, expect, it } from "vitest";
import { extractYouTubeVideoId, songInputSchema, takedownInputSchema, youtubeVideoIdSchema } from "@/lib/catalogue/validation";

describe("YouTube validation", () => {
  it("accepts direct 11-character IDs", () => {
    expect(youtubeVideoIdSchema.safeParse("dQw4w9WgXcQ").success).toBe(true);
  });

  it("extracts IDs from supported YouTube URLs", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://youtube.com/shorts/dQw4w9WgXcQ?feature=share")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects invalid YouTube IDs and arbitrary URLs", () => {
    expect(youtubeVideoIdSchema.safeParse("not-valid").success).toBe(false);
    expect(extractYouTubeVideoId("https://example.com/internal/admin")).toBeNull();
  });

  it("rejects invalid takedown submissions", () => {
    const result = takedownInputSchema.safeParse({
      songOrYoutubeUrl: "https://youtu.be/dQw4w9WgXcQ",
      claimantName: "A",
      claimantEmail: "not-email",
      rightsHolder: "R",
      requestDetails: "Too short",
      evidenceUrl: "javascript:alert(1)",
      confirmation: "off",
      company: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts null optional song fields and normalizes them", () => {
    const result = songInputSchema.safeParse({
      title: "Song",
      teluguTitle: null,
      film: "Film",
      releaseYear: "2001",
      durationSeconds: "240",
      singers: "Singer",
      composer: "Composer",
      lyricist: null,
      youtubeInput: "dQw4w9WgXcQ",
      spotifyUrl: null,
      youtubeMusicUrl: "",
      editorialNote: null,
      editorialNoteTelugu: undefined,
      thumbnailUrl: null,
      embedStatus: "available",
      channelIds: [],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.teluguTitle).toBe("");
      expect(result.data.lyricist).toBe("");
      expect(result.data.spotifyUrl).toBeNull();
    }
  });

  it("returns field-specific errors for null required song fields", () => {
    const result = songInputSchema.safeParse({
      title: null,
      film: "Film",
      releaseYear: "2001",
      durationSeconds: "240",
      singers: "Singer",
      composer: "Composer",
      youtubeInput: "dQw4w9WgXcQ",
      embedStatus: "available",
      channelIds: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["title"]);
      expect(result.error.issues[0]?.message).toBe("Title is required.");
      expect(result.error.message).not.toContain("expected string, received null");
    }
  });
});
