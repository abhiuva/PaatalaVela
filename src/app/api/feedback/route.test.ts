import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_CHANNEL_ID = "6f3fc628-a517-4dc5-a479-334d6bce7558";
const UNKNOWN_CHANNEL_ID = "7e2fb3d0-2942-4c90-9b3f-8b5c31de6fc4";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  channelEq: vi.fn(),
  channelMaybeSingle: vi.fn(),
  analyse: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => table === "channels"
      ? { select: () => ({ eq: mocks.channelEq }) }
      : { insert: mocks.insert },
  }),
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

function acceptInsert(id = "feedback-1") {
  mocks.insert.mockReturnValue({
    select: () => ({ single: vi.fn().mockResolvedValue({ data: { id }, error: null }) }),
  });
}

describe("public feedback endpoint", () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.channelEq.mockReset().mockImplementation(() => ({ maybeSingle: mocks.channelMaybeSingle }));
    mocks.channelMaybeSingle.mockReset().mockResolvedValue({ data: { id: VALID_CHANNEL_ID }, error: null });
    mocks.analyse.mockReset().mockResolvedValue({ status: "pending" });
  });

  it("accepts a valid existing Supabase channel UUID and inserts it", async () => {
    acceptInsert();
    const response = await POST(request({ channelId: VALID_CHANNEL_ID }));

    expect(response.status).toBe(200);
    expect(mocks.channelEq).toHaveBeenCalledWith("id", VALID_CHANNEL_ID);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ channel_id: VALID_CHANNEL_ID }));
  });

  it.each([
    ["null", { channelId: null }],
    ["omitted", {}],
  ])("accepts %s channelId as general feedback", async (_label, payload) => {
    acceptInsert();
    const response = await POST(request(payload));

    expect(response.status).toBe(200);
    expect(mocks.channelEq).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ channel_id: null }));
  });

  it.each([
    ["empty string", ""],
    ["channel slug", "tea-shop-classics"],
  ])("rejects %s instead of a channel UUID", async (_label, channelId) => {
    const response = await POST(request({ channelId }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, code: "FEEDBACK_CHANNELID_INVALID", field: "channelId" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects an unknown structurally valid channel UUID", async () => {
    mocks.channelMaybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await POST(request({ channelId: UNKNOWN_CHANNEL_ID }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, code: "FEEDBACK_CHANNEL_NOT_FOUND", field: "channelId" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("inserts validated public feedback without accepting sentiment fields", async () => {
    acceptInsert();
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
    acceptInsert("feedback-2");
    mocks.analyse.mockResolvedValue({ status: "failed", code: "SENTIMENT_ANALYSIS_FAILED" });
    const response = await POST(request({ comment: "Playback slow ga undi" }));
    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.analyse).toHaveBeenCalledWith(expect.anything(), "feedback-2", "Playback slow ga undi");
  });
});
