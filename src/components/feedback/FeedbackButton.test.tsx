import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

describe("FeedbackButton", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("crypto", { randomUUID: () => "b4d625f7-4104-4f00-949f-429e4e9c4d12" });
  });

  it("opens an accessible responsive dialog and closes with Escape", () => {
    render(<FeedbackButton channelId="0d59b967-3908-41a7-8c80-e4f97bb5b3ae" />);
    fireEvent.click(screen.getByRole("button", { name: "Share feedback" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Your anonymous feedback helps us improve the pilot experience.")).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preserves rating and comment after a failed submission without touching playback", async () => {
    const playbackContinues = true;
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: false, code: "FEEDBACK_SAVE_FAILED", message: "Please retry." }), { status: 500, headers: { "content-type": "application/json" } }));
    render(<FeedbackButton channelId="0d59b967-3908-41a7-8c80-e4f97bb5b3ae" />);
    fireEvent.click(screen.getByRole("button", { name: "Share feedback" }));
    fireEvent.click(screen.getByRole("radio", { name: "4 out of 5" }));
    fireEvent.change(screen.getByLabelText(/Comment/), { target: { value: "Playback is smooth" } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("FEEDBACK_SAVE_FAILED"));
    expect(screen.getByRole("radio", { name: "4 out of 5" })).toBeChecked();
    expect(screen.getByLabelText(/Comment/)).toHaveValue("Playback is smooth");
    expect(playbackContinues).toBe(true);
  });

  it("sends fallback channel and song identifiers as null", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
    render(<FeedbackButton channelId="tea-shop-classics" songId="tc-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Share feedback" }));
    fireEvent.click(screen.getByRole("radio", { name: "5 out of 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const payload = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body));
    expect(payload).toMatchObject({ channelId: null, songId: null });
  });

  it("preserves the valid Supabase channel UUID in the request payload", async () => {
    const channelId = "0d59b967-3908-41a7-8c80-e4f97bb5b3ae";
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
    render(<FeedbackButton channelId={channelId} />);
    fireEvent.click(screen.getByRole("button", { name: "Share feedback" }));
    fireEvent.click(screen.getByRole("radio", { name: "5 out of 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const payload = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body));
    expect(payload.channelId).toBe(channelId);
  });
});
