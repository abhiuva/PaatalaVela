import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  analyse: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceSupabaseClient: () => ({ from: () => ({ insert: mocks.insert }) }),
}));
vi.mock("@/lib/feedback/service", () => ({ analyseStoredFeedback: mocks.analyse }));

import { POST } from "@/app/api/feedback/route";

function request(overrides: Record<string, unknown> = {}, agent = crypto.randomUUID()) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": agent },
    body: JSON.stringify({ rating: 4, comment: "Songs bagunnayi", submissionToken: crypto.randomUUID(), ...overrides }),
  });
}

describe("public feedback endpoint", () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.analyse.mockReset().mockResolvedValue({ status: "pending" });
  });

  it("inserts validated public feedback without accepting sentiment fields", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "feedback-1" }, error: null });
    mocks.insert.mockReturnValue({ select: () => ({ single }) });
    const response = await POST(request({ sentiment_label: "positive", admin_sentiment_override: "positive" }));
    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ rating: 4, comment: "Songs bagunnayi", sentiment_status: "pending" }));
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("sentiment_label");
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("admin_sentiment_override");
  });

  it("rejects a duplicate token with a stable safe error", async () => {
    mocks.insert.mockReturnValue({ select: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } }) }) });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, code: "FEEDBACK_DUPLICATE" });
  });

  it("retains the inserted feedback when sentiment processing reports failure", async () => {
    mocks.insert.mockReturnValue({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: "feedback-2" }, error: null }) }) });
    mocks.analyse.mockResolvedValue({ status: "failed", code: "SENTIMENT_ANALYSIS_FAILED" });
    const response = await POST(request({ comment: "Playback slow ga undi" }));
    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.analyse).toHaveBeenCalledWith(expect.anything(), "feedback-2", "Playback slow ga undi");
  });
});
