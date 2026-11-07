import { describe, expect, it } from "vitest";
import { moodIntentSchema, type MoodCandidate } from "@/lib/mood-assistant/types";
import { moodDurationToleranceSeconds, rankMoodPlaylist } from "@/lib/mood-assistant/recommendation";

function candidate(id: string, overrides: Partial<MoodCandidate> = {}): MoodCandidate {
  return {
    id,
    title: `Song ${id}`,
    film: `Film ${id}`,
    year: 1995,
    singers: [`Singer ${id}`],
    composer: `Composer ${id}`,
    thumbnailUrl: null,
    story: null,
    context: null,
    languageCode: "te",
    eraCode: "1990s",
    moods: ["nostalgic"],
    occasions: ["rain", "driving"],
    energy: "medium",
    valence: "positive",
    regions: ["andhra-pradesh"],
    youtubeVideoId: `${id}ABCDEFGHIJK`.slice(0, 11),
    durationSeconds: 240,
    assignmentId: `10000000-0000-4000-8000-${id.padStart(12, "0")}`,
    channelId: "20000000-0000-4000-8000-000000000001",
    active: true,
    embedStatus: "available",
    classificationConfidence: 1,
    classificationSource: "editorial",
    ...overrides,
  };
}

function intent(overrides: Record<string, unknown> = {}) {
  return moodIntentSchema.parse({ confidence: 0.9, clarificationRequired: false, clarificationQuestion: null, ...overrides });
}

describe("Mood Assistant recommendation ranking", () => {
  it("returns only the requested language", () => {
    const ranked = rankMoodPlaylist([candidate("1"), candidate("2", { languageCode: "hi" })], intent({ languages: ["hi"], songCount: 5 }));
    expect(ranked.playlist.map((item) => item.song.id)).toEqual(["2"]);
  });

  it("honours fixed song counts and avoids duplicates", () => {
    const songs = [candidate("1"), candidate("2"), candidate("3"), candidate("3")];
    const ranked = rankMoodPlaylist(songs, intent({ songCount: 2 }));
    expect(ranked.playlist).toHaveLength(2);
    expect(new Set(ranked.playlist.map((item) => item.song.id)).size).toBe(2);
  });

  it("stops close to a duration target", () => {
    const songs = Array.from({ length: 20 }, (_, index) => candidate(String(index + 1), { durationSeconds: 210 }));
    const ranked = rankMoodPlaylist(songs, intent({ durationMinutes: 30 }));
    expect(Math.abs(ranked.durationSeconds - 30 * 60)).toBeLessThanOrEqual(moodDurationToleranceSeconds);
  });

  it("excludes unavailable, invalid and durationless videos", () => {
    const ranked = rankMoodPlaylist([
      candidate("1", { embedStatus: "unavailable" }),
      candidate("2", { youtubeVideoId: "bad" }),
      candidate("3", { durationSeconds: null }),
      candidate("4"),
    ], intent({ durationMinutes: 15 }));
    expect(ranked.playlist.map((item) => item.song.id)).toEqual(["4"]);
  });

  it("enforces negative constraints", () => {
    const ranked = rankMoodPlaylist([
      candidate("1", { moods: ["melancholic"] }),
      candidate("2", { moods: ["breakup", "reflective"] }),
    ], intent({ moods: ["breakup"], exclusions: ["melancholic"], songCount: 5 }));
    expect(ranked.playlist.map((item) => item.song.id)).toEqual(["2"]);
  });

  it("filters previously generated songs during refinement", () => {
    const ranked = rankMoodPlaylist([candidate("1"), candidate("2")], intent({ songCount: 5 }), ["1"]);
    expect(ranked.playlist.map((item) => item.song.id)).toEqual(["2"]);
  });

  it("diversifies singers, composers and films", () => {
    const songs = [
      candidate("1", { singers: ["Same"], composer: "Same", film: "Same" }),
      candidate("2", { singers: ["Same"], composer: "Same", film: "Same" }),
      candidate("3", { singers: ["Different"], composer: "Different", film: "Different" }),
    ];
    const ranked = rankMoodPlaylist(songs, intent({ songCount: 3 }));
    expect(ranked.playlist[1].song.id).toBe("3");
  });

  it("returns an empty result rather than inventing catalogue entries", () => {
    expect(rankMoodPlaylist([], intent({ languages: ["te"] })).playlist).toEqual([]);
  });
});
