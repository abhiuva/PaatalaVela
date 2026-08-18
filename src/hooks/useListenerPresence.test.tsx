import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useListenerPresence } from "@/hooks/useListenerPresence";

const options = { isPlaying: false, hasUserInteracted: false, channelId: "tea-shop-classics", songId: "1f64281a-5acc-4981-af55-ae324cfe5952" };

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
    expect(localStorage.getItem("paatalavela.presence-session")).toBe("b4d625f7-4104-4f00-949f-429e4e9c4d12");
    expect(() => { first.unmount(); second.unmount(); }).not.toThrow();
  });
});
