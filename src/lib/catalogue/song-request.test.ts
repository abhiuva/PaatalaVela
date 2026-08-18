import { describe, expect, it } from "vitest";
import { songRequestInputSchema } from "@/lib/catalogue/validation";

describe("song request validation", () => {
  it("accepts valid anonymous requests", () => {
    expect(
      songRequestInputSchema.safeParse({
        songName: "Song",
        filmName: "Film",
        singer: "",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        requestedChannelId: "mass-beat-centre",
        reason: "This fits the channel mood.",
        company: "",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(
      songRequestInputSchema.safeParse({
        songName: "Song",
        filmName: "Film",
        youtubeUrl: "javascript:alert(1)",
        requestedChannelId: "mass-beat-centre",
        company: "",
      }).success,
    ).toBe(false);
  });
});
