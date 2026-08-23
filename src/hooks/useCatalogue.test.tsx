import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCatalogue } from "@/hooks/useCatalogue";
import type { Channel } from "@/types/radio";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function channel(id: string, slug: string, title = "initial"): Channel {
  return { id, slug, mode: "on_demand", scheduled: false, languageCode: "en", name: slug, teluguName: slug, strapline: slug, mood: slug, backgroundImageUrl: null, schedule: { startHour: 0, endHour: 0 }, palette: { from: "#000000", via: "#111111", to: "#222222", accent: "#ffffff" }, songs: [{ id: `${id}-song`, title, film: "Film", year: 2024, singers: ["Singer"], composer: "Composer", thumbnailUrl: null, story: null, context: null, languageCode: "en", eraCode: "2020s", moods: [], occasions: [], youtubeVideoId: "abcdefghijk", durationSeconds: 120 }] };
}

function response(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

describe("useCatalogue targeted refresh", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ignores an obsolete channel response and keeps queues isolated by UUID", async () => {
    const firstId = "00000000-0000-4000-8000-000000000001";
    const secondId = "00000000-0000-4000-8000-000000000002";
    const firstRequest = deferred<Response>();
    const secondRequest = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
      void options;
      const url = String(input);
      if (url === "/api/catalogue") return Promise.resolve(response({ channels: [channel(firstId, "first"), channel(secondId, "second")], source: "supabase" }));
      if (url.includes(firstId)) return firstRequest.promise;
      return secondRequest.promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCatalogue());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let firstPromise!: Promise<Channel | null>;
    let secondPromise!: Promise<Channel | null>;
    act(() => { firstPromise = result.current.refreshChannel(firstId); });
    act(() => { secondPromise = result.current.refreshChannel(secondId); });
    await act(async () => secondRequest.resolve(response({ channel: channel(secondId, "second", "fresh-second") })));
    await secondPromise;
    await act(async () => firstRequest.resolve(response({ channel: channel(firstId, "first", "stale-first") })));
    await firstPromise;

    expect(result.current.channels.find((item) => item.id === secondId)?.songs[0].title).toBe("fresh-second");
    expect(result.current.channels.find((item) => item.id === firstId)?.songs[0].title).toBe("initial");
    expect(result.current.channelLoadState).toEqual({ channelId: secondId, status: "ready" });
    expect(fetchMock.mock.calls.slice(1).every(([, options]) => (options as RequestInit).cache === "no-store")).toBe(true);
  });
});
