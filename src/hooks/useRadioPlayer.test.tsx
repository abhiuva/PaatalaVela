import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRadioPlayer } from "@/hooks/useRadioPlayer";
import type { Channel, Song } from "@/types/radio";
import { trackRadioEvent } from "@/lib/radio/analytics";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "@/config/brand";

vi.mock("@/lib/radio/analytics", () => ({ trackRadioEvent: vi.fn() }));

const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"];

function song(id: string, sequence: number): Song {
  return { id, title: id, film: "Film", year: 2024, singers: ["Singer"], composer: "Composer", thumbnailUrl: null, story: null, context: null, languageCode: "te", eraCode: "2020s", moods: [], occasions: [], youtubeVideoId: `${id}xxxxxxxxxxx`.slice(0, 11), durationSeconds: 120, sequence, active: true, embedStatus: "available" };
}

function channel(id: string, slug: string, songs: Song[], mode: Channel["mode"] = "scheduled", languageCode = "te"): Channel {
  return { id, slug, mode, scheduled: mode === "scheduled", languageCode, name: slug, teluguName: slug, strapline: slug, mood: slug, backgroundImageUrl: null, schedule: { startHour: slug === "first" ? 5 : 9, endHour: slug === "first" ? 9 : 13 }, palette: { from: "#000000", via: "#111111", to: "#222222", accent: "#ffffff" }, songs: songs.map((entry) => ({ ...entry, languageCode })) };
}

describe("useRadioPlayer channel lifecycle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

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

  it("restores and migrates the legacy volume before persisting the default", async () => {
    window.localStorage.setItem(LEGACY_STORAGE_KEYS.volume[0], "42");
    const channels = [channel(ids[0], "first", [song("a", 1)])];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.volume).toBe(42));
    expect(window.localStorage.getItem(STORAGE_KEYS.volume)).toBe("42");
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEYS.volume[0])).toBeNull();
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
    expect(result.current.playbackNotice).toBe("Upcoming songs shuffled");
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

  it("uses the same shuffled queue for manual and automatic advancement", async () => {
    const catalogue = Array.from({ length: 10 }, (_, index) => song(String.fromCharCode(97 + index), index + 1));
    const channels = [channel(ids[0], "first", catalogue)];
    const manual = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(manual.result.current.song).not.toBeNull());
    act(() => manual.result.current.selectChannel("first"));
    act(() => manual.result.current.toggleShuffle());
    const manualIds: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      act(() => manual.result.current.nextTrack());
      manualIds.push(manual.result.current.song?.id ?? "");
    }
    manual.unmount();

    window.localStorage.clear();
    const automatic = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(automatic.result.current.song).not.toBeNull());
    act(() => automatic.result.current.selectChannel("first"));
    act(() => automatic.result.current.toggleShuffle());
    const automaticIds: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      act(() => automatic.result.current.handleEnded());
      automaticIds.push(automatic.result.current.song?.id ?? "");
    }
    expect(automaticIds).toEqual(manualIds);
    expect(manualIds[0]).not.toBe("b");
  });

  it("keeps English Hits on the shared shuffled queue until disabled", async () => {
    const englishSongs = Array.from({ length: 10 }, (_, index) => song(String.fromCharCode(97 + index), index + 1));
    const channels = [channel(ids[0], "first", [song("t", 1)]), channel(ids[1], "english-hits", englishSongs, "on_demand", "en")];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song).not.toBeNull());
    act(() => result.current.selectChannel("english-hits"));
    act(() => result.current.toggleShuffle());
    const shuffled: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      act(() => result.current.nextTrack());
      shuffled.push(result.current.song?.id ?? "");
    }
    expect(shuffled).not.toEqual(["b", "c", "d"]);
    expect(result.current.shuffleEnabled).toBe(true);

    const currentIndex = englishSongs.findIndex((entry) => entry.id === result.current.song?.id);
    act(() => result.current.toggleShuffle());
    act(() => result.current.nextTrack());
    expect(result.current.song?.id).toBe(englishSongs[(currentIndex + 1) % englishSongs.length].id);
  });

  it("excludes an unavailable English assignment from the shared shuffled queue", async () => {
    const available = Array.from({ length: 6 }, (_, index) => song(String.fromCharCode(97 + index), index + 1));
    const unavailable = { ...song("blocked", 7), embedStatus: "unavailable" as const };
    const channels = [channel(ids[0], "first", [song("t", 1)]), channel(ids[1], "english-hits", [...available, unavailable], "on_demand", "en")];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song).not.toBeNull());
    act(() => result.current.selectChannel("english-hits"));
    act(() => result.current.toggleShuffle());
    const offered: string[] = [];
    for (let index = 0; index < available.length - 1; index += 1) {
      act(() => result.current.nextTrack());
      offered.push(result.current.song?.id ?? "");
    }
    expect(offered).not.toContain("blocked");
    expect(result.current.queue.items).toHaveLength(available.length);
  });

  it("rebuilds shuffle state during rapid switches to and from English Hits", async () => {
    const telugu = [song("a", 1), song("b", 2), song("c", 3), song("d", 4), song("e", 5), song("f", 6)];
    const english = [song("x", 1), song("y", 2), song("z", 3), song("u", 4), song("v", 5), song("w", 6)];
    const channels = [channel(ids[0], "first", telugu), channel(ids[1], "english-hits", english, "on_demand", "en")];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song).not.toBeNull());
    act(() => result.current.selectChannel("first"));
    act(() => result.current.toggleShuffle());
    act(() => result.current.selectChannel("english-hits"));
    act(() => result.current.selectChannel("first"));
    act(() => result.current.selectChannel("english-hits"));
    act(() => result.current.nextTrack());
    expect(english.map((entry) => entry.id)).toContain(result.current.song?.id);
    expect(telugu.map((entry) => entry.id)).not.toContain(result.current.song?.id);
  });

  it("fires shuffle analytics exactly once per mode change", async () => {
    const channels = [channel(ids[0], "first", [song("a", 1), song("b", 2), song("c", 3)])];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song).not.toBeNull());
    vi.mocked(trackRadioEvent).mockClear();
    act(() => result.current.toggleShuffle());
    act(() => result.current.toggleShuffle());
    const shuffleCalls = vi.mocked(trackRadioEvent).mock.calls.filter(([event]) => event === "shuffle_mode_changed");
    expect(shuffleCalls).toHaveLength(2);
    expect(shuffleCalls.map(([, properties]) => properties?.new_mode)).toEqual(["shuffle", "normal"]);
  });

  it("preserves the English on-demand entry, index, and shuffled queue across visibility resumes", async () => {
    const englishSongs = Array.from({ length: 10 }, (_, index) => song(String.fromCharCode(97 + index), index + 1));
    const channels = [channel(ids[0], "first", [song("t", 1)]), channel(ids[1], "english-hits", englishSongs, "on_demand", "en")];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song).not.toBeNull());
    act(() => result.current.selectChannel("english-hits"));
    act(() => result.current.toggleShuffle());
    act(() => result.current.nextTrack());
    const before = { assignmentId: result.current.song?.assignmentId, trackIndex: result.current.trackIndex, seekRevision: result.current.seekRevision };
    vi.mocked(trackRadioEvent).mockClear();

    for (let count = 0; count < 5; count += 1) {
      let authoritative = false;
      act(() => {
        authoritative = result.current.handleVisibilityResume({ queueEntryId: before.assignmentId ?? null, videoId: result.current.song?.youtubeVideoId ?? null, positionSeconds: 44, playerState: 1 });
      });
      expect(authoritative).toBe(true);
    }

    expect(result.current.song?.assignmentId).toBe(before.assignmentId);
    expect(result.current.trackIndex).toBe(before.trackIndex);
    expect(result.current.seekRevision).toBe(before.seekRevision);
    expect(result.current.shuffleEnabled).toBe(true);
    expect(trackRadioEvent).not.toHaveBeenCalled();
    act(() => result.current.nextTrack());
    expect(result.current.song?.assignmentId).not.toBe(before.assignmentId);
    expect(result.current.shuffleEnabled).toBe(true);
  });

  it("preserves the Hindi on-demand song and position request on return", async () => {
    const channels = [channel(ids[0], "first", [song("t", 1)]), channel(ids[2], "hindi-hits", [song("h", 1), song("i", 2)], "on_demand", "hi")];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song).not.toBeNull());
    act(() => result.current.selectChannel("hindi-hits"));
    const entry = result.current.song?.assignmentId;
    const revision = result.current.seekRevision;
    act(() => result.current.handleVisibilityResume({ queueEntryId: entry ?? null, videoId: result.current.song?.youtubeVideoId ?? null, positionSeconds: 73, playerState: 2 }));
    expect(result.current.song?.assignmentId).toBe(entry);
    expect(result.current.seekRevision).toBe(revision);
  });

  it("preserves the current assignment across harmless catalogue object and metadata changes", async () => {
    const base = [channel(ids[0], "first", [song("a", 1), song("b", 2), song("c", 3)])];
    const { result, rerender } = renderHook(({ channels }) => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels), { initialProps: { channels: base } });
    await waitFor(() => expect(result.current.song).not.toBeNull());
    act(() => result.current.selectChannel("first"));
    act(() => result.current.nextTrack());
    const before = { assignmentId: result.current.song?.assignmentId, trackIndex: result.current.trackIndex, seekRevision: result.current.seekRevision };
    const refreshed = base.map((entry) => ({ ...entry, strapline: "Updated copy", songs: entry.songs.map((item) => ({ ...item, story: "Updated metadata" })) }));
    rerender({ channels: refreshed });
    expect(result.current.song?.assignmentId).toBe(before.assignmentId);
    expect(result.current.trackIndex).toBe(before.trackIndex);
    expect(result.current.seekRevision).toBe(before.seekRevision);
  });

  it("selects a valid remaining assignment when a catalogue refresh removes the current entry", async () => {
    const base = [channel(ids[0], "first", [song("a", 1), song("b", 2), song("c", 3)])];
    const { result, rerender } = renderHook(({ channels }) => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels), { initialProps: { channels: base } });
    await waitFor(() => expect(result.current.song).not.toBeNull());
    act(() => result.current.selectChannel("first"));
    act(() => result.current.nextTrack());
    expect(result.current.song?.id).toBe("b");
    const refreshed = [{ ...base[0], songs: base[0].songs.filter((entry) => entry.id !== "b") }];
    rerender({ channels: refreshed });
    expect(result.current.song?.id).toBe("a");
    expect(result.current.queue.items.map((entry) => entry.id)).toEqual(["a", "c"]);
  });

  it("uses a distinct Tap to resume state without changing the selected entry", async () => {
    const channels = [channel(ids[0], "first", [song("a", 1), song("b", 2)])];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song).not.toBeNull());
    act(() => result.current.selectChannel("first"));
    const entry = result.current.song?.assignmentId;
    act(() => result.current.handleResumeBlocked());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.resumeRequired).toBe(true);
    expect(result.current.playbackNotice).toBe("Tap to resume");
    expect(result.current.song?.assignmentId).toBe(entry);
  });

  it("ignores a duplicate player-ready callback after playback is confirmed", async () => {
    const channels = [channel(ids[0], "first", [song("a", 1), song("b", 2)])];
    const { result } = renderHook(() => useRadioPlayer(new Date("2026-08-23T06:00:00+05:30"), channels));
    await waitFor(() => expect(result.current.song).not.toBeNull());
    act(() => result.current.handlePlayerReady());
    act(() => result.current.handlePlaybackStarted(result.current.song!.youtubeVideoId));
    expect(result.current.playbackStatus).toBe("playing");
    act(() => result.current.handlePlayerReady());
    expect(result.current.playbackStatus).toBe("playing");
  });
});
