import { beforeEach, describe, expect, it, vi } from "vitest";
import { completionRate, validateAnalyticsEvent } from "@/lib/analytics/events";
import { getAnalyticsConsent, initialiseAnalytics, setAnalyticsConsent, trackEvent } from "@/lib/analytics/client";
import { resolveChannelReference } from "@/lib/analytics/channel-reference";

describe("analytics validation", () => {
  it("resolves public channel slugs to database UUIDs for daily metrics", async () => {
    const lookup = vi.fn().mockResolvedValue("8caee376-2a9c-4000-9fd7-e0d8c8561913");
    await expect(resolveChannelReference("suprabhata-melodies", lookup)).resolves.toBe("8caee376-2a9c-4000-9fd7-e0d8c8561913");
    expect(lookup).toHaveBeenCalledWith("suprabhata-melodies");
  });

  it("rejects invalid event names", () => {
    expect(validateAnalyticsEvent("bad_event", {})).toEqual({ ok: false, message: "Unsupported analytics event." });
  });

  it("rejects oversized payloads", () => {
    const result = validateAnalyticsEvent("fallback_catalogue_used", { session_id: "session_1", reason: "x".repeat(4000) });
    expect(result.ok).toBe(false);
  });

  it("rejects personal information fields", () => {
    const result = validateAnalyticsEvent("song_started", {
      session_id: "session_1",
      song_id: "song_1",
      channel_id: "channel_1",
      playback_mode: "live",
      sequence: 10,
      started_from_seconds: 0,
      email: "person@example.com",
    });
    expect(result.ok).toBe(false);
  });

  it("bounds listening time and completion percent", () => {
    expect(
      validateAnalyticsEvent("song_completed", {
        session_id: "session_1",
        song_id: "song_1",
        channel_id: "channel_1",
        listened_seconds: 999999999,
        completion_percent: 101,
      }).ok,
    ).toBe(false);
  });

  it("uses documented completion denominator", () => {
    expect(completionRate(9, 10)).toBe(0.9);
    expect(completionRate(1, 0)).toBe(0);
  });

  it("accepts language-aware on-demand channel events", () => {
    expect(validateAnalyticsEvent("channel_selected", {
      session_id: "session_1",
      channel_id: "82f73275-0c49-4fc9-991d-61d9d6e3c492",
      previous_channel_id: "6f3fc628-a517-4dc5-a479-334d6bce7558",
      language_code: "hi",
      channel_mode: "on_demand",
    }).ok).toBe(true);
  });

  it("accepts non-sensitive shuffle mode transitions", () => {
    expect(validateAnalyticsEvent("shuffle_mode_changed", {
      session_id: "session_1",
      channel_id: "6f3fc628-a517-4dc5-a479-334d6bce7558",
      channel_slug: "english-hits",
      previous_mode: "normal",
      new_mode: "shuffle",
    }).ok).toBe(true);
  });
});

describe("analytics consent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("does not send analytics before consent", () => {
    initialiseAnalytics();
    trackEvent("schedule_viewed", { session_id: "session_1" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejection keeps analytics disabled", () => {
    setAnalyticsConsent("rejected");
    trackEvent("schedule_viewed", { session_id: "session_1" });
    expect(getAnalyticsConsent()).toBe("rejected");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("acceptance stores consent while tests still suppress event sending", () => {
    setAnalyticsConsent("accepted");
    trackEvent("schedule_viewed", { session_id: "session_1" });
    expect(getAnalyticsConsent()).toBe("accepted");
    expect(fetch).not.toHaveBeenCalled();
  });
});
