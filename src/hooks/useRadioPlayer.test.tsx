import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useRadioPlayer } from "@/hooks/useRadioPlayer";
import type { Channel, Song } from "@/types/radio";

const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"];

function song(id: string, sequence: number): Song {
  return { id, title: id, film: "Film", year: 2024, singers: ["Singer"], composer: "Composer", thumbnailUrl: null, story: null, context: null, languageCode: "te", eraCode: "2020s", moods: [], occasions: [], youtubeVideoId: `${id}xxxxxxxxxxx`.slice(0, 11), durationSeconds: 120, sequence, active: true, embedStatus: "available" };
}

function channel(id: string, slug: string, songs: Song[]): Channel {
  return { id, slug, mode: "scheduled", scheduled: true, languageCode: "te", name: slug, teluguName: slug, strapline: slug, mood: slug, backgroundImageUrl: null, schedule: { startHour: slug === "first" ? 5 : 9, endHour: slug === "first" ? 9 : 13 }, palette: { from: "#000000", via: "#111111", to: "#222222", accent: "#ffffff" }, songs };
}

describe("useRadioPlayer channel lifecycle", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts the selected populated channel from the channel click gesture", async () => {
    const channels = [channel(ids[0], "first", [song("a", 1)]), channel(ids[1], "second", [song("b", 1)])];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.channel.slug).toBe("first"));
    act(() => result.current.selectChannel("second"));
    expect(result.current.channel.id).toBe(ids[1]);
    expect(result.current.song?.id).toBe("b");
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.playbackStatus).toBe("loading");
  });

  it("stops instead of retaining an old song when the selected channel is empty", async () => {
    const channels = [channel(ids[0], "first", [song("a", 1)]), channel(ids[1], "second", [])];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song?.id).toBe("a"));
    act(() => result.current.selectChannel("second"));
    expect(result.current.song).toBeNull();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.playbackStatus).toBe("exhausted");
  });

  it("toggles shuffle without restarting and uses it only for the next transition", async () => {
    const channels = [channel(ids[0], "first", [song("a", 1), song("b", 2), song("c", 3)])];
    const { result, unmount } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song).not.toBeNull());
    act(() => result.current.selectChannel("first"));
    const currentSong = result.current.song?.id;
    const revision = result.current.seekRevision;
    act(() => result.current.toggleShuffle());
    expect(result.current.shuffleEnabled).toBe(true);
    expect(result.current.song?.id).toBe(currentSong);
    expect(result.current.seekRevision).toBe(revision);
    act(() => result.current.nextTrack());
    expect(result.current.song?.id).not.toBe(currentSong);
    unmount();
    const restored = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(restored.result.current.shuffleEnabled).toBe(true));
  });

  it("bounds player-error recovery and exhausts after each eligible song fails", async () => {
    const channels = [channel(ids[0], "first", [song("a", 1), song("b", 2)])];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song).not.toBeNull());
    act(() => result.current.handlePlayerError());
    expect(result.current.song?.id).toBe("b");
    act(() => result.current.handlePlayerError());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.playbackStatus).toBe("exhausted");
  });

  it("advances automatically without marking live playback as listener-offset", async () => {
    const channels = [channel(ids[0], "first", [song("a", 1), song("b", 2), song("c", 3)])];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song).not.toBeNull());
    const before = result.current.song?.id;
    act(() => result.current.handleEnded());
    expect(result.current.song?.id).not.toBe(before);
    expect(result.current.listenerOffset).toBe(false);
  });

  it("uses identical ordered transitions for five manual and automatic advances", async () => {
    const songs = [song("a", 1), song("b", 1), song("c", 2), song("d", 3), song("e", 4), song("f", 5)];
    const channels = [channel(ids[0], "first", songs)];
    const manual = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    const automatic = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(manual.result.current.song).not.toBeNull());
    await waitFor(() => expect(automatic.result.current.song).not.toBeNull());
    act(() => manual.result.current.selectChannel("first"));
    act(() => automatic.result.current.selectChannel("first"));
    const manualIds: string[] = [];
    const automaticIds: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      act(() => manual.result.current.nextTrack());
      act(() => automatic.result.current.handleEnded());
      manualIds.push(manual.result.current.song?.id ?? "");
      automaticIds.push(automatic.result.current.song?.id ?? "");
    }
    expect(automaticIds).toEqual(manualIds);
    expect(manualIds).toEqual(["b", "c", "d", "e", "f"]);
  });

  it("ignores duplicate ended callbacks for the same loaded queue entry", async () => {
    const channels = [channel(ids[0], "first", [song("a", 1), song("b", 2), song("c", 3)])];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song).not.toBeNull());
    act(() => result.current.selectChannel("first"));
    const ended = result.current.handleEnded;
    act(() => {
      ended();
      ended();
    });
    expect(result.current.song?.id).toBe("b");
  });
});
