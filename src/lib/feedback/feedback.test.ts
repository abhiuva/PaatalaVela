import { describe, expect, it } from "vitest";
import { analyticsHealthStatus, excludeTestEvents, feedbackMetrics, filterFeedback } from "@/lib/feedback/analytics";
import { consumeRateLimit } from "@/lib/feedback/rate-limit";
import { feedbackInputSchema, satisfactionFromRating } from "@/lib/feedback/validation";
import type { DbFeedbackSubmission } from "@/types/database";

const valid = { rating: 5, submissionToken: "b4d625f7-4104-4f00-949f-429e4e9c4d12" };
const row = (changes: Partial<DbFeedbackSubmission> = {}): DbFeedbackSubmission => ({
  id: "1", rating: 5, comment: "బాగుంది", category: "music_selection", channel_id: null, song_id: null,
  page_path: "/", anonymous_session_id: "session_1", app_version: null, submission_token_hash: "x".repeat(64),
  sentiment_status: "completed", sentiment_label: "positive", sentiment_score: 0.8, sentiment_confidence: 0.9,
  sentiment_summary: "Positive", detected_themes: ["music"], sentiment_analyzed_at: new Date().toISOString(),
  sentiment_error_code: null, admin_sentiment_override: null, created_at: "2026-08-18T10:00:00.000Z", ...changes,
});

describe("feedback validation", () => {
  it("requires a rating constrained to integers 1 through 5", () => {
    expect(feedbackInputSchema.safeParse({ submissionToken: valid.submissionToken }).success).toBe(false);
    expect(feedbackInputSchema.safeParse({ ...valid, rating: 0 }).success).toBe(false);
    expect(feedbackInputSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
    expect(feedbackInputSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an absent or empty optional comment and limits it to 1000 characters", () => {
    expect(feedbackInputSchema.parse(valid).comment).toBeNull();
    expect(feedbackInputSchema.parse({ ...valid, comment: "" }).comment).toBeNull();
    expect(feedbackInputSchema.safeParse({ ...valid, comment: "x".repeat(1000) }).success).toBe(true);
    expect(feedbackInputSchema.safeParse({ ...valid, comment: "x".repeat(1001) }).success).toBe(false);
  });

  it("accepts nullable channel UUIDs but rejects empty values and slugs", () => {
    expect(feedbackInputSchema.parse(valid).channelId).toBeNull();
    expect(feedbackInputSchema.parse({ ...valid, channelId: null }).channelId).toBeNull();
    expect(feedbackInputSchema.safeParse({ ...valid, channelId: "0d59b967-3908-41a7-8c80-e4f97bb5b3ae" }).success).toBe(true);
    expect(feedbackInputSchema.safeParse({ ...valid, channelId: "" }).success).toBe(false);
    expect(feedbackInputSchema.safeParse({ ...valid, channelId: "tea-shop-classics" }).success).toBe(false);
  });

  it("keeps rating satisfaction separate from comment sentiment", () => {
    expect(satisfactionFromRating(1)).toBe("dissatisfied");
    expect(satisfactionFromRating(3)).toBe("neutral");
    expect(satisfactionFromRating(5)).toBe("satisfied");
    expect(feedbackMetrics([row({ rating: 1, sentiment_label: "positive" })]).dissatisfiedPercentage).toBe(100);
  });
});

describe("feedback operations", () => {
  it("rate limits after the configured allowance and resets its window", () => {
    const store = new Map();
    expect(consumeRateLimit(store, "anonymous", 0, 2, 100)).toBe(false);
    expect(consumeRateLimit(store, "anonymous", 1, 2, 100)).toBe(false);
    expect(consumeRateLimit(store, "anonymous", 2, 2, 100)).toBe(true);
    expect(consumeRateLimit(store, "anonymous", 101, 2, 100)).toBe(false);
  });

  it("filters admin feedback without exposing technical identifiers", () => {
    const rows = [row(), row({ id: "2", rating: 1, category: "playback", sentiment_label: "negative" })];
    expect(filterFeedback(rows, { rating: 1, sentiment: "negative" })).toEqual([rows[1]]);
  });

  it("calculates health from configuration, real event freshness and aggregation freshness", () => {
    const now = Date.parse("2026-08-18T12:00:00Z");
    expect(analyticsHealthStatus({ configured: false, lastEventAt: null, eventsLast24Hours: 0, latestAggregationAt: null }, now)).toBe("Misconfigured");
    expect(analyticsHealthStatus({ configured: true, lastEventAt: null, eventsLast24Hours: 0, latestAggregationAt: null }, now)).toBe("No data");
    expect(analyticsHealthStatus({ configured: true, lastEventAt: "2026-08-18T11:00:00Z", eventsLast24Hours: 2, latestAggregationAt: "2026-08-18T11:00:00Z" }, now)).toBe("Healthy");
  });

  it("excludes clearly marked test events from production metrics", () => {
    const events = [{ is_test: false, properties: {} }, { is_test: true, properties: {} }, { properties: { is_test: true } }];
    expect(excludeTestEvents(events)).toEqual([events[0]]);
  });
});
