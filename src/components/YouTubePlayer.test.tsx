import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import type { YTConstructor, YTPlayer } from "@/types/youtube";

describe("YouTubePlayer lifecycle", () => {
  afterEach(() => vi.useRealTimers());
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
    const common = { isPlaying: false, hasUserInteracted: true, volume: 70, seekSeconds: 0, seekRevision: 1, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
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
    const common = { isPlaying: false, hasUserInteracted: true, volume: 70, seekSeconds: 0, seekRevision: 1, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onEnded: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
    const view = render(<YouTubePlayer {...common} videoId="aaaaaaaaaaa" />);
    await waitFor(() => expect(player).toBeDefined());
    view.rerender(<YouTubePlayer {...common} videoId={null} seekRevision={2} />);
    await waitFor(() => expect(player.stopVideo).toHaveBeenCalled());
  });

  it("omits the videoId constructor option while the catalogue is loading", async () => {
    let options!: ConstructorParameters<YTConstructor>[1];
    const Player = function (_elementId: string, nextOptions: ConstructorParameters<YTConstructor>[1]) {
      options = nextOptions;
      return { loadVideoById: vi.fn(), cueVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), setVolume: vi.fn(), destroy: vi.fn() } as YTPlayer;
    } as unknown as YTConstructor;
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
    const common = { videoId: null, isPlaying: false, hasUserInteracted: false, volume: 70, seekSeconds: 0, seekRevision: 0, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked: vi.fn(), onEnded: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
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
    const common = { videoId: "aaaaaaaaaaa", isPlaying: true, hasUserInteracted: true, volume: 70, seekSeconds: 0, seekRevision: 1, onReady: vi.fn(), onPlaybackStarted: vi.fn(), onAutoplayBlocked, onEnded: vi.fn(), onError: vi.fn(), onPositionChange: vi.fn() };
    await act(async () => { render(<YouTubePlayer {...common} />); await Promise.resolve(); });
    act(() => options.events.onReady({ target: player }));
    act(() => vi.advanceTimersByTime(3000));
    expect(onAutoplayBlocked).toHaveBeenCalledTimes(1);
  });
});
