import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { analyseStoredFeedback } from "@/lib/feedback/service";
import { consumeRateLimit } from "@/lib/feedback/rate-limit";
import { feedbackInputSchema, formatFeedbackValidationError } from "@/lib/feedback/validation";

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const agent = request.headers.get("user-agent") ?? "unknown";
  return digest(`${forwarded}:${agent}`);
}

export async function POST(request: Request) {
  if (consumeRateLimit(rateLimit, requestFingerprint(request))) {
    return NextResponse.json({ ok: false, code: "FEEDBACK_RATE_LIMITED", message: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "FEEDBACK_INVALID_JSON", message: "Review the feedback and try again." }, { status: 400 });
  }

  const parsed = feedbackInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, ...formatFeedbackValidationError(parsed.error) }, { status: 400 });
  }
  if (parsed.data.website) {
    return NextResponse.json({ ok: false, code: "FEEDBACK_REJECTED", message: "Unable to submit feedback." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, code: "FEEDBACK_NOT_CONFIGURED", message: "Feedback is temporarily unavailable. Please try again later." }, { status: 503 });
  }

  const hasComment = Boolean(parsed.data.comment);
  const { data, error } = await supabase.from("feedback_submissions").insert({
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    category: parsed.data.category,
    channel_id: parsed.data.channelId,
    song_id: parsed.data.songId,
    page_path: parsed.data.pagePath,
    anonymous_session_id: parsed.data.anonymousSessionId,
    app_version: parsed.data.appVersion,
    submission_token_hash: digest(parsed.data.submissionToken),
    sentiment_status: hasComment ? "pending" : "completed",
    sentiment_analyzed_at: hasComment ? null : new Date().toISOString(),
  }).select("id").single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: false, code: "FEEDBACK_DUPLICATE", message: "This feedback was already submitted." }, { status: 409 });
    }
    console.error("Feedback insert failed", { code: error.code });
    return NextResponse.json({ ok: false, code: "FEEDBACK_SAVE_FAILED", message: "Feedback could not be saved. Your answers are still here; please retry." }, { status: 500 });
  }

  if (hasComment && data) {
    await analyseStoredFeedback(supabase, data.id, parsed.data.comment!);
  }

  return NextResponse.json({ ok: true, message: "Thank you for helping improve Paatala Vela." });
}
