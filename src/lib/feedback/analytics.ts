import type { DbFeedbackSubmission, FeedbackCategory, SentimentLabel } from "@/types/database";
import { satisfactionFromRating } from "@/lib/feedback/validation";

export type FeedbackFilters = {
  from?: string;
  to?: string;
  rating?: number;
  sentiment?: SentimentLabel;
  category?: FeedbackCategory;
  channelId?: string;
  songId?: string;
};

export function filterFeedback(rows: DbFeedbackSubmission[], filters: FeedbackFilters) {
  return rows.filter((row) => {
    const day = row.created_at.slice(0, 10);
    const effectiveSentiment = row.admin_sentiment_override ?? row.sentiment_label;
    return (!filters.from || day >= filters.from)
      && (!filters.to || day <= filters.to)
      && (!filters.rating || row.rating === filters.rating)
      && (!filters.sentiment || effectiveSentiment === filters.sentiment)
      && (!filters.category || row.category === filters.category)
      && (!filters.channelId || row.channel_id === filters.channelId)
      && (!filters.songId || row.song_id === filters.songId);
  });
}

export function feedbackMetrics(rows: DbFeedbackSubmission[]) {
  const comments = rows.filter((row) => Boolean(row.comment));
  const analysed = comments.filter((row) => Boolean(row.admin_sentiment_override ?? row.sentiment_label));
  const count = rows.length;
  const percentage = (part: number, whole = count) => whole ? (part / whole) * 100 : 0;
  return {
    total: count,
    averageRating: count ? rows.reduce((sum, row) => sum + row.rating, 0) / count : 0,
    satisfiedPercentage: percentage(rows.filter((row) => satisfactionFromRating(row.rating) === "satisfied").length),
    dissatisfiedPercentage: percentage(rows.filter((row) => satisfactionFromRating(row.rating) === "dissatisfied").length),
    commentRate: percentage(comments.length),
    positivePercentage: percentage(analysed.filter((row) => (row.admin_sentiment_override ?? row.sentiment_label) === "positive").length, analysed.length),
    negativePercentage: percentage(analysed.filter((row) => (row.admin_sentiment_override ?? row.sentiment_label) === "negative").length, analysed.length),
    pending: comments.filter((row) => row.sentiment_status === "pending" || row.sentiment_status === "failed").length,
  };
}

export type AnalyticsHealthInput = {
  configured: boolean;
  lastEventAt: string | null;
  eventsLast24Hours: number;
  latestAggregationAt: string | null;
};

export function analyticsHealthStatus(input: AnalyticsHealthInput, now = Date.now()) {
  if (!input.configured) return "Misconfigured" as const;
  if (!input.lastEventAt || input.eventsLast24Hours === 0) return "No data" as const;
  const lastEventAge = now - new Date(input.lastEventAt).getTime();
  const aggregationAge = input.latestAggregationAt ? now - new Date(input.latestAggregationAt).getTime() : Number.POSITIVE_INFINITY;
  if (lastEventAge > 24 * 60 * 60_000 || aggregationAge > 48 * 60 * 60_000) return "Delayed" as const;
  return "Healthy" as const;
}

export function escapeCsv(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function excludeTestEvents<T extends { is_test?: boolean; properties?: Record<string, unknown> }>(events: T[]) {
  return events.filter((event) => !event.is_test && event.properties?.is_test !== true);
}
