import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MoodAssistant } from "@/components/MoodAssistant";

const response = {
  ok: true,
  generationId: "40000000-0000-4000-8000-000000000001",
  intent: { moods: ["peaceful"], occasions: ["rain"], languages: ["te"], regions: [], durationMinutes: 45, songCount: null, eras: [], singers: [], composers: [], energy: "low", valence: "positive", exclusions: [], clarificationRequired: false, clarificationQuestion: null },
  assistantResponse: "I found 1 verified Telugu match.",
  playlist: [{ song: { id: "10000000-0000-4000-8000-000000000001", title: "Verified song", film: "Film", year: 2020, singers: ["Singer"], composer: "Composer", thumbnailUrl: null, story: null, context: null, languageCode: "te", eraCode: "2020s", moods: ["peaceful"], occasions: ["rain"], youtubeVideoId: "abcdefghijk", durationSeconds: 180, assignmentId: "20000000-0000-4000-8000-000000000001", channelId: "30000000-0000-4000-8000-000000000001", active: true, embedStatus: "available" }, reason: "Matched Telugu + rain + peaceful." }],
  playlistDurationSeconds: 180,
  clarificationRequired: false,
  clarificationQuestion: null,
  providerMode: "fallback",
  timings: { interpretationMs: 1, catalogueMs: 1, rankingMs: 1, totalMs: 3 },
};

describe("MoodAssistant", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } })));
  });

  it("renders controls, preserves input while loading and activates a verified preview", async () => {
    const onActivate = vi.fn();
    render(<MoodAssistant active={false} currentQueueIds={[]} playedSongIds={[]} onActivate={onActivate} />);
    fireEvent.click(screen.getByRole("button", { name: /Mood Assistant/i }));
    const input = screen.getByLabelText("What fits this moment?");
    fireEvent.change(input, { target: { value: "Telugu rain melodies" } });
    fireEvent.click(screen.getByRole("button", { name: "Create playlist" }));
    expect((input as HTMLTextAreaElement).value).toBe("Telugu rain melodies");
    await screen.findByText("Verified song");
    expect(screen.getByText(/deterministic matching/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onActivate).toHaveBeenCalledWith([response.playlist[0].song], response.generationId);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
