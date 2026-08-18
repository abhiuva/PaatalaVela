import "server-only";

import type { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getSentimentProvider } from "@/lib/feedback/sentiment";

type ServiceClient = NonNullable<ReturnType<typeof createServiceSupabaseClient>>;

export async function analyseStoredFeedback(supabase: ServiceClient, feedbackId: string, comment: string) {
  const provider = getSentimentProvider();
  if (!provider) return { status: "pending" as const };

  await supabase.from("feedback_submissions").update({ sentiment_status: "processing", sentiment_error_code: null }).eq("id", feedbackId);
  try {
    const result = await provider.analyse(comment);
    await supabase.from("feedback_submissions").update({
      sentiment_status: "completed",
      sentiment_label: result.label,
      sentiment_score: result.score,
      sentiment_confidence: result.confidence,
      sentiment_summary: result.summary,
      detected_themes: result.themes,
      sentiment_analyzed_at: new Date().toISOString(),
      sentiment_error_code: null,
    }).eq("id", feedbackId);
    return { status: "completed" as const };
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("SENTIMENT_") ? error.message : "SENTIMENT_ANALYSIS_FAILED";
    await supabase.from("feedback_submissions").update({ sentiment_status: "failed", sentiment_error_code: code }).eq("id", feedbackId);
    return { status: "failed" as const, code };
  }
}
