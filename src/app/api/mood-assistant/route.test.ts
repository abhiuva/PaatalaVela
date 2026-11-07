import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mood-assistant/service", () => ({
  generateMoodPlaylist: vi.fn().mockResolvedValue({
    ok: true,
    generationId: "40000000-0000-4000-8000-000000000001",
    intent: { moods: ["peaceful"], occasions: [], languages: ["te"], regions: [], durationMinutes: null, songCount: 1, eras: [], singers: [], composers: [], energy: null, valence: null, exclusions: [], clarificationRequired: false, clarificationQuestion: null },
    assistantResponse: "One verified match.",
    playlist: [],
    playlistDurationSeconds: 0,
    clarificationRequired: false,
    clarificationQuestion: null,
    providerMode: "fallback",
    timings: { interpretationMs: 1, catalogueMs: 1, rankingMs: 1, totalMs: 3 },
  }),
}));
vi.mock("@/lib/mood-assistant/repository", () => ({ recordMoodGeneration: vi.fn() }));

import { POST, resetMoodAssistantRateLimitForTests } from "@/app/api/mood-assistant/route";
import { generateMoodPlaylist } from "@/lib/mood-assistant/service";

function request(body: unknown, address = "127.0.0.1") {
  return new Request("http://localhost/api/mood-assistant", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": address, "user-agent": "test" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mood-assistant", () => {
  beforeEach(() => resetMoodAssistantRateLimitForTests());

  it("rejects overlong input with a safe field error", async () => {
    const response = await POST(request({ message: "x".repeat(501) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "MOOD_ASSISTANT_INVALID_INPUT", field: "message" });
  });

  it("returns a validated generation response", async () => {
    const response = await POST(request({ message: "Peaceful Telugu", currentQueueIds: [] }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, generationId: "40000000-0000-4000-8000-000000000001" });
  });

  it("reports an unapplied catalogue migration as unavailable", async () => {
    vi.mocked(generateMoodPlaylist).mockRejectedValueOnce(new Error("MOOD_CATALOGUE_NOT_CONFIGURED"));
    const response = await POST(request({ message: "Peaceful Telugu", currentQueueIds: [] }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "MOOD_ASSISTANT_NOT_CONFIGURED" });
  });

  it("rate limits repeated requests", async () => {
    for (let index = 0; index < 10; index += 1) expect((await POST(request({ message: "Telugu songs" }))).status).toBe(200);
    const blocked = await POST(request({ message: "Telugu songs" }));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ code: "MOOD_ASSISTANT_RATE_LIMITED" });
  });
});
