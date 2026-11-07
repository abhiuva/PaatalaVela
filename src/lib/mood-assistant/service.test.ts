import { describe, expect, it, vi } from "vitest";
import { generateMoodPlaylist } from "@/lib/mood-assistant/service";
import type { MoodCandidate, MoodInterpreter } from "@/lib/mood-assistant/types";

const fallbackCandidate: MoodCandidate = {
  id: "10000000-0000-4000-8000-000000000001", title: "Verified", film: "Film", year: 2020, singers: ["Singer"], composer: "Composer", thumbnailUrl: null, story: null, context: null, languageCode: "te", eraCode: "2020s", moods: ["peaceful"], occasions: ["morning"], energy: "low", valence: "positive", regions: [], youtubeVideoId: "abcdefghijk", durationSeconds: 180, assignmentId: "20000000-0000-4000-8000-000000000001", channelId: "30000000-0000-4000-8000-000000000001", active: true, embedStatus: "available", classificationConfidence: 1, classificationSource: "editorial",
};

describe("Mood Assistant service", () => {
  it("falls back when the provider times out", async () => {
    const provider: MoodInterpreter = { interpret: vi.fn().mockRejectedValue(new DOMException("Timed out", "AbortError")) };
    const result = await generateMoodPlaylist(
      { message: "Peaceful Telugu morning", selections: { songCount: 1 }, conversationContext: [], currentQueueIds: [] },
      { provider, candidates: async () => [fallbackCandidate], generationId: () => "40000000-0000-4000-8000-000000000001" },
    );
    expect(result.providerMode).toBe("fallback");
    expect(result.playlist[0].song.id).toBe(fallbackCandidate.id);
  });

  it("falls back when provider output fails schema validation", async () => {
    const provider = { interpret: vi.fn().mockResolvedValue({ moods: ["invented"] }) } as unknown as MoodInterpreter;
    const result = await generateMoodPlaylist(
      { message: "One Telugu song", selections: { songCount: 1 }, conversationContext: [], currentQueueIds: [] },
      { provider, candidates: async () => [fallbackCandidate] },
    );
    expect(result.providerMode).toBe("fallback");
  });

  it("returns bounded timing instrumentation without the raw request", async () => {
    let time = 0;
    const result = await generateMoodPlaylist(
      { message: "Peaceful Telugu", selections: { songCount: 1 }, conversationContext: [], currentQueueIds: [] },
      { provider: null, candidates: async () => [fallbackCandidate], now: () => time += 25 },
    );
    expect(result.timings).toEqual({ interpretationMs: 25, catalogueMs: 25, rankingMs: 25, totalMs: 75 });
    expect(JSON.stringify(result)).not.toContain("Peaceful Telugu");
    expect(result.intent).not.toHaveProperty("confidence");
  });
});
