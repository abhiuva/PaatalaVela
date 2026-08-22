import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LiveListenerCount, listenerCountText } from "@/components/presence/LiveListenerCount";

const thresholds = { daily: 5, concurrent: 25, channel: 10 };
const ready = (total: number, channel: number | null, daily: number | null) => ({ status: "ready" as const, total, channel, daily, thresholds, asOf: "2026-08-22T00:00:00Z" });

describe("LiveListenerCount", () => {
  it("uses honest adaptive wording at every threshold boundary", () => {
    expect(listenerCountText(ready(0, 0, 0), "Tea Shop Classics")).toBe("Join today’s listeners");
    expect(listenerCountText(ready(4, 4, 5), "Tea Shop Classics")).toBe("5 people tuned in today");
    expect(listenerCountText(ready(25, 4, 5), "Tea Shop Classics")).toBe("25 people listening now");
    expect(listenerCountText(ready(25, 10, 5), "Tea Shop Classics")).toBe("10 people are listening to Tea Shop Classics");
    expect(listenerCountText({ status: "error" }, "Tea Shop Classics")).toBe("Listener activity unavailable");
  });

  it("shows unavailable instead of a false zero when the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<LiveListenerCount channelSlug="tea-shop-classics" channelName="Tea Shop Classics" />);
    await waitFor(() => expect(screen.getByText("Listener activity unavailable")).toBeVisible());
    expect(screen.queryByText("Join today’s listeners")).not.toBeInTheDocument();
  });

  it("refreshes immediately when the browser reconnects", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, total: 0, channel: 0, daily: 0, asOf: "2026-08-22T00:00:00Z", thresholds }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<LiveListenerCount channelSlug="tea-shop-classics" channelName="Tea Shop Classics" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent(window, new Event("online"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
