import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useListenerPresence } from "@/hooks/useListenerPresence";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "@/config/brand";

const options = { isPlaying: false, hasUserInteracted: false, channelSlug: "tea-shop-classics", songId: "1f64281a-5acc-4981-af55-ae324cfe5952" };

describe("listener presence lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("crypto", { randomUUID: () => "b4d625f7-4104-4f00-949f-429e4e9c4d12" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
  });

  it("does not count a page load where playback was never activated", () => {
    renderHook(() => useListenerPresence(options));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("starts presence on playback and pauses the same session without inflating identity", async () => {
    const { rerender } = renderHook((props) => useListenerPresence(props), { initialProps: { ...options, hasUserInteracted: true, isPlaying: true } });
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const first = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(first).toMatchObject({ sessionId: "b4d625f7-4104-4f00-949f-429e4e9c4d12", playerState: "playing" });
    rerender({ ...options, hasUserInteracted: true, isPlaying: false });
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some((call) => JSON.parse(String(call[1]?.body)).playerState === "paused")).toBe(true));
  });

  it("reuses one local session across tabs and ignores presence failures", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const first = renderHook(() => useListenerPresence({ ...options, hasUserInteracted: true, isPlaying: true }));
    const second = renderHook(() => useListenerPresence({ ...options, hasUserInteracted: true, isPlaying: true }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(localStorage.getItem(STORAGE_KEYS.presenceSession)).toBe("b4d625f7-4104-4f00-949f-429e4e9c4d12");
    expect(() => { first.unmount(); second.unmount(); }).not.toThrow();
  });

  it("migrates a valid legacy presence identity without replacing it", async () => {
    localStorage.setItem(LEGACY_STORAGE_KEYS.presenceSession[0], "12ba2e9c-c7a2-4651-8412-258a8058beca");
    renderHook(() => useListenerPresence({ ...options, hasUserInteracted: true, isPlaying: true }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body.sessionId).toBe("12ba2e9c-c7a2-4651-8412-258a8058beca");
    expect(localStorage.getItem(STORAGE_KEYS.presenceSession)).toBe(body.sessionId);
    expect(localStorage.getItem(LEGACY_STORAGE_KEYS.presenceSession[0])).toBeNull();
  });

  it("restarts only presence signaling after repeated visibility changes", async () => {
    renderHook(() => useListenerPresence({ ...options, hasUserInteracted: true, isPlaying: true }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const signals = vi.mocked(fetch).mock.calls.map((call) => JSON.parse(String(call[1]?.body)).playerState);
    expect(signals).toEqual(["playing", "playing"]);
    expect(localStorage.getItem(STORAGE_KEYS.presenceSession)).toBe("b4d625f7-4104-4f00-949f-429e4e9c4d12");
  });
});
