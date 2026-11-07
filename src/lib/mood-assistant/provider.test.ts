import { describe, expect, it, vi } from "vitest";
import { HttpMoodInterpreter } from "@/lib/mood-assistant/provider";

describe("Mood Assistant provider adapter", () => {
  it("sends only listener intent context and validates provider JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        moods: ["peaceful"], occasions: ["rain"], languages: ["te"], regions: [], durationMinutes: 45, songCount: null, eras: [], singers: [], composers: [], energy: "low", valence: "positive", exclusions: [], confidence: 0.9, clarificationRequired: false, clarificationQuestion: null,
      }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const provider = new HttpMoodInterpreter("https://provider.example/interpret", "secret", "intent-model", fetcher);
    const intent = await provider.interpret({ message: "Telugu rain songs", selections: { durationMinutes: 45 } }, []);
    expect(intent.languages).toEqual(["te"]);
    const requestBody = String(fetcher.mock.calls[0][1]?.body);
    expect(requestBody).toContain("Telugu rain songs");
    expect(requestBody).not.toContain("youtube_video_id");
    expect(requestBody).not.toContain("secret");
  });

  it("rejects invalid model JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200 }));
    const provider = new HttpMoodInterpreter("https://provider.example/interpret", "secret", "intent-model", fetcher);
    await expect(provider.interpret({ message: "Telugu songs" }, [])).rejects.toThrow();
  });
});
