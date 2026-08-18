import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LiveListenerCount, listenerCountText } from "@/components/presence/LiveListenerCount";

describe("LiveListenerCount", () => {
  it("formats zero, singular and channel-aware counts", () => {
    expect(listenerCountText({ status: "ready", total: 0, channel: 0 })).toBe("Be the first listener");
    expect(listenerCountText({ status: "ready", total: 1, channel: 1 })).toBe("1 listening now · 1 on this channel");
    expect(listenerCountText({ status: "ready", total: 12, channel: 3 })).toBe("12 listening now · 3 on this channel");
  });

  it("shows unavailable instead of a false zero when count loading fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<LiveListenerCount channelId="tea-shop-classics" />);
    await waitFor(() => expect(screen.getByText("Live listeners unavailable")).toBeVisible());
    expect(screen.queryByText("Be the first listener")).not.toBeInTheDocument();
  });
});
