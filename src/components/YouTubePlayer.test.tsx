import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import type { YTConstructor, YTPlayer } from "@/types/youtube";

describe("YouTubePlayer lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it("keeps one player and sends events to the latest channel callbacks", async () => {
    const instances: Array<{ options: ConstructorParameters<YTConstructor>[1]; player: YTPlayer }> = [];
    const Player = function (_elementId: string, options: ConstructorParameters<YTConstructor>[1]) {
      const player = { loadVideoById: vi.fn(), cueVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), setVolume: vi.fn(), destroy: vi.fn() } as YTPlayer;
      instances.push({ options, player });
      return player;
    } as unknown as YTConstructor;
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
    const firstEnded = vi.fn();
    const secondEnded = vi.fn();
    const common = { queueEntryId: "entry-a", isPlaying: false, hasUserInteracted: true, volume: 70, seekSeconds: 0, seekRevision: 1, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onResumeBlocked: vi.fn(), onVisibilityResume: vi.fn(() => true), onError: vi.fn(), onPositionChange: vi.fn() };
    const view = render(<YouTubePlayer {...common} videoId="aaaaaaaaaaa" onEnded={firstEnded} />);
    await waitFor(() => expect(instances).toHaveLength(1));
    act(() => instances[0].options.events.onReady({ target: instances[0].player }));
    view.rerender(<YouTubePlayer {...common} videoId="bbbbbbbbbbb" seekRevision={2} onEnded={secondEnded} />);
    act(() => instances[0].options.events.onStateChange({ data: 0, target: instances[0].player }));
    expect(firstEnded).not.toHaveBeenCalled();
    expect(secondEnded).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(1);
  });

  it("stops the current video when the queue becomes empty", async () => {
    let player!: YTPlayer;
    const Player = function (_elementId: string, options: ConstructorParameters<YTConstructor>[1]) {
      player = { loadVideoById: vi.fn(), cueVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), setVolume: vi.fn(), destroy: vi.fn() } as YTPlayer;
      queueMicrotask(() => options.events.onReady({ target: player }));
      return player;
    } as unknown as YTConstructor;
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
    const common = { queueEntryId: "entry-a", isPlaying: false, hasUserInteracted: true, volume: 70, seekSeconds: 0, seekRevision: 1, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onResumeBlocked: vi.fn(), onVisibilityResume: vi.fn(() => true), onEnded: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
    const view = render(<YouTubePlayer {...common} videoId="aaaaaaaaaaa" />);
    await waitFor(() => expect(player).toBeDefined());
    view.rerender(<YouTubePlayer {...common} videoId={null} seekRevision={2} />);
    await waitFor(() => expect(player.stopVideo).toHaveBeenCalled());
  });

  it("ignores a stale ENDED event from the previously loaded video", async () => {
    let options!: ConstructorParameters<YTConstructor>[1];
    let player!: YTPlayer;
    let renderedVideoId = "aaaaaaaaaaa";
    const Player = function (_elementId: string, nextOptions: ConstructorParameters<YTConstructor>[1]) {
      options = nextOptions;
      player = { loadVideoById: vi.fn((id: string) => { renderedVideoId = id; }), cueVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), getVideoData: vi.fn(() => ({ video_id: renderedVideoId })), setVolume: vi.fn(), destroy: vi.fn() } as YTPlayer;
      return player;
    } as unknown as YTConstructor;
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
    const onEnded = vi.fn();
    const common = { queueEntryId: "entry-a", isPlaying: true, hasUserInteracted: true, volume: 70, seekSeconds: 0, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onResumeBlocked: vi.fn(), onVisibilityResume: vi.fn(() => true), onEnded, onError: vi.fn(), onPositionChange: vi.fn() };
    const view = render(<YouTubePlayer {...common} videoId="aaaaaaaaaaa" seekRevision={1} />);
    await waitFor(() => expect(options).toBeDefined());
    act(() => options.events.onReady({ target: player }));
    view.rerender(<YouTubePlayer {...common} videoId="bbbbbbbbbbb" seekRevision={2} />);
    await waitFor(() => expect(player.loadVideoById).toHaveBeenCalledWith("bbbbbbbbbbb"));
    renderedVideoId = "aaaaaaaaaaa";
    act(() => options.events.onStateChange({ data: 0, target: player }));
    expect(onEnded).not.toHaveBeenCalled();
  });

  it("omits the videoId constructor option while the catalogue is loading", async () => {
    let options!: ConstructorParameters<YTConstructor>[1];
    const Player = function (_elementId: string, nextOptions: ConstructorParameters<YTConstructor>[1]) {
      options = nextOptions;
      return { loadVideoById: vi.fn(), cueVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), setVolume: vi.fn(), destroy: vi.fn() } as YTPlayer;
    } as unknown as YTConstructor;
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
    const common = { queueEntryId: null, videoId: null, isPlaying: false, hasUserInteracted: false, volume: 70, seekSeconds: 0, seekRevision: 0, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onResumeBlocked: vi.fn(), onVisibilityResume: vi.fn(() => true), onEnded: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
    render(<YouTubePlayer {...common} />);
    await waitFor(() => expect(options).toBeDefined());
    expect(Object.hasOwn(options, "videoId")).toBe(false);
  });

  it("reports a blocked play request when PLAYING is not confirmed", async () => {
    vi.useFakeTimers();
    let options!: ConstructorParameters<YTConstructor>[1];
    let player!: YTPlayer;
    const Player = function (_elementId: string, nextOptions: ConstructorParameters<YTConstructor>[1]) {
      options = nextOptions;
      player = { loadVideoById: vi.fn(), cueVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), setVolume: vi.fn(), destroy: vi.fn() } as YTPlayer;
      return player;
    } as unknown as YTConstructor;
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
    const onAutoplayBlocked = vi.fn();
    const common = { queueEntryId: "entry-a", videoId: "aaaaaaaaaaa", isPlaying: true, hasUserInteracted: true, volume: 70, seekSeconds: 0, seekRevision: 1, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked, onResumeBlocked: vi.fn(), onVisibilityResume: vi.fn(() => true), onEnded: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
    await act(async () => { render(<YouTubePlayer {...common} />); await Promise.resolve(); });
    act(() => options.events.onReady({ target: player }));
    act(() => vi.advanceTimersByTime(3000));
    expect(onAutoplayBlocked).toHaveBeenCalledTimes(1);
  });

  it("keeps the same player and issues no media command when background playback continues", async () => {
    let options!: ConstructorParameters<YTConstructor>[1];
    let instanceCount = 0;
    const player = { loadVideoById: vi.fn(), cueVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn(() => 45), getPlayerState: vi.fn(() => 1), getVideoData: vi.fn(() => ({ video_id: "aaaaaaaaaaa" })), setVolume: vi.fn(), destroy: vi.fn() } as YTPlayer;
    const Player = function (_elementId: string, nextOptions: ConstructorParameters<YTConstructor>[1]) { instanceCount += 1; options = nextOptions; return player; } as unknown as YTConstructor;
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
    const onVisibilityResume = vi.fn(() => true);
    const common = { queueEntryId: "entry-a", videoId: "aaaaaaaaaaa", isPlaying: true, hasUserInteracted: true, volume: 70, seekSeconds: 45, seekRevision: 1, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onResumeBlocked: vi.fn(), onVisibilityResume, onEnded: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
    render(<YouTubePlayer {...common} />);
    await waitFor(() => expect(options).toBeDefined());
    act(() => options.events.onReady({ target: player }));
    await waitFor(() => expect(player.loadVideoById).toHaveBeenCalledTimes(1));
    vi.mocked(player.loadVideoById).mockClear();
    vi.mocked(player.cueVideoById).mockClear();
    vi.mocked(player.playVideo).mockClear();
    vi.mocked(player.seekTo).mockClear();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(onVisibilityResume).toHaveBeenCalledWith({ queueEntryId: "entry-a", videoId: "aaaaaaaaaaa", positionSeconds: 45, playerState: 1 });
    expect(instanceCount).toBe(1);
    expect(player.loadVideoById).not.toHaveBeenCalled();
    expect(player.cueVideoById).not.toHaveBeenCalled();
    expect(player.playVideo).not.toHaveBeenCalled();
    expect(player.seekTo).not.toHaveBeenCalled();
  });

  it("resumes a suspended current entry without reloading and deduplicates resume events", async () => {
    vi.useFakeTimers();
    let options!: ConstructorParameters<YTConstructor>[1];
    let playerState = 2;
    const player = { loadVideoById: vi.fn(), cueVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn(() => 60), getPlayerState: vi.fn(() => playerState), getVideoData: vi.fn(() => ({ video_id: "aaaaaaaaaaa" })), setVolume: vi.fn(), destroy: vi.fn() } as YTPlayer;
    const Player = function (_elementId: string, nextOptions: ConstructorParameters<YTConstructor>[1]) { options = nextOptions; return player; } as unknown as YTConstructor;
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
    const onResumeBlocked = vi.fn();
    const common = { queueEntryId: "entry-a", videoId: "aaaaaaaaaaa", isPlaying: true, hasUserInteracted: true, volume: 70, seekSeconds: 60, seekRevision: 1, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onResumeBlocked, onVisibilityResume: vi.fn(() => true), onEnded: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
    await act(async () => { render(<YouTubePlayer {...common} />); await Promise.resolve(); });
    act(() => options.events.onReady({ target: player }));
    await act(async () => Promise.resolve());
    vi.mocked(player.loadVideoById).mockClear();
    vi.mocked(player.playVideo).mockClear();
    vi.mocked(player.seekTo).mockClear();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pageshow"));
    });
    expect(player.playVideo).toHaveBeenCalledTimes(1);
    expect(player.loadVideoById).not.toHaveBeenCalled();
    expect(player.seekTo).not.toHaveBeenCalled();

    playerState = 1;
    act(() => options.events.onStateChange({ data: 1, target: player }));
    act(() => vi.advanceTimersByTime(3000));
    expect(onResumeBlocked).not.toHaveBeenCalled();
  });

  it("reports Tap to resume when a suspended resume attempt is blocked", async () => {
    vi.useFakeTimers();
    let options!: ConstructorParameters<YTConstructor>[1];
    const player = { loadVideoById: vi.fn(), cueVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn(() => 60), getPlayerState: vi.fn(() => 2), getVideoData: vi.fn(() => ({ video_id: "aaaaaaaaaaa" })), setVolume: vi.fn(), destroy: vi.fn() } as YTPlayer;
    const Player = function (_elementId: string, nextOptions: ConstructorParameters<YTConstructor>[1]) { options = nextOptions; return player; } as unknown as YTConstructor;
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
    const onResumeBlocked = vi.fn();
    const common = { queueEntryId: "entry-a", videoId: "aaaaaaaaaaa", isPlaying: true, hasUserInteracted: true, volume: 70, seekSeconds: 60, seekRevision: 1, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onResumeBlocked, onVisibilityResume: vi.fn(() => true), onEnded: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
    await act(async () => { render(<YouTubePlayer {...common} />); await Promise.resolve(); });
    act(() => options.events.onReady({ target: player }));
    await act(async () => Promise.resolve());
    vi.mocked(player.playVideo).mockClear();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => vi.advanceTimersByTime(3000));
    expect(player.playVideo).toHaveBeenCalledTimes(1);
    expect(onResumeBlocked).toHaveBeenCalledTimes(1);
  });

  it("treats same-entry seek revisions idempotently and loads only a different entry", async () => {
    let options!: ConstructorParameters<YTConstructor>[1];
    const player = { loadVideoById: vi.fn(), cueVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), getPlayerState: vi.fn(() => 2), setVolume: vi.fn(), destroy: vi.fn() } as YTPlayer;
    const Player = function (_elementId: string, nextOptions: ConstructorParameters<YTConstructor>[1]) { options = nextOptions; return player; } as unknown as YTConstructor;
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
    const common = { queueEntryId: "entry-a", videoId: "aaaaaaaaaaa", isPlaying: false, hasUserInteracted: true, volume: 70, seekSeconds: 0, seekRevision: 1, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onResumeBlocked: vi.fn(), onVisibilityResume: vi.fn(() => true), onEnded: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
    const view = render(<YouTubePlayer {...common} />);
    await waitFor(() => expect(options).toBeDefined());
    act(() => options.events.onReady({ target: player }));
    await waitFor(() => expect(player.cueVideoById).toHaveBeenCalledTimes(1));
    vi.mocked(player.cueVideoById).mockClear();
    vi.mocked(player.seekTo).mockClear();

    view.rerender(<YouTubePlayer {...common} seekRevision={2} seekSeconds={30} />);
    await waitFor(() => expect(player.seekTo).toHaveBeenCalledWith(30, true));
    expect(player.cueVideoById).not.toHaveBeenCalled();
    expect(player.loadVideoById).not.toHaveBeenCalled();

    view.rerender(<YouTubePlayer {...common} queueEntryId="entry-b" seekRevision={3} />);
    await waitFor(() => expect(player.cueVideoById).toHaveBeenCalledWith("aaaaaaaaaaa"));
  });

  it("destroys the player only on genuine component unmount", async () => {
    let options!: ConstructorParameters<YTConstructor>[1];
    const player = { loadVideoById: vi.fn(), cueVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), setVolume: vi.fn(), destroy: vi.fn() } as YTPlayer;
    const Player = function (_elementId: string, nextOptions: ConstructorParameters<YTConstructor>[1]) { options = nextOptions; return player; } as unknown as YTConstructor;
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
    const common = { queueEntryId: "entry-a", videoId: "aaaaaaaaaaa", isPlaying: false, hasUserInteracted: false, volume: 70, seekSeconds: 0, seekRevision: 1, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onResumeBlocked: vi.fn(), onVisibilityResume: vi.fn(() => true), onEnded: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
    const view = render(<YouTubePlayer {...common} />);
    await waitFor(() => expect(options).toBeDefined());
    expect(player.destroy).not.toHaveBeenCalled();
    view.unmount();
    expect(player.destroy).toHaveBeenCalledTimes(1);
  });

  it("keeps exactly one live player through React Strict Mode effect replay", async () => {
    const players: YTPlayer[] = [];
    const Player = function () {
      const player = { loadVideoById: vi.fn(), cueVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), setVolume: vi.fn(), destroy: vi.fn() } as YTPlayer;
      players.push(player);
      return player;
    } as unknown as YTConstructor;
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
    const common = { queueEntryId: "entry-a", videoId: "aaaaaaaaaaa", isPlaying: false, hasUserInteracted: false, volume: 70, seekSeconds: 0, seekRevision: 1, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onResumeBlocked: vi.fn(), onVisibilityResume: vi.fn(() => true), onEnded: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
    const view = render(<StrictMode><YouTubePlayer {...common} /></StrictMode>);
    await waitFor(() => expect(players).toHaveLength(1));
    expect(players[0].destroy).not.toHaveBeenCalled();
    view.unmount();
    expect(players[0].destroy).toHaveBeenCalledTimes(1);
  });
});
