import { NextRequest, NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { escapeCsv, filterFeedback, type FeedbackFilters } from "@/lib/feedback/analytics";
import { satisfactionFromRating } from "@/lib/feedback/validation";
import type { DbFeedbackSubmission, FeedbackCategory, SentimentLabel } from "@/types/database";

export async function GET(request: NextRequest) {
  const context = await getAdminContext();
  if (context.status !== "ok" || context.profile.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 });
  const supabase = createServiceSupabaseClient();
  if (!supabase) return NextResponse.json({ message: "Supabase is not configured." }, { status: 503 });
  const params = request.nextUrl.searchParams;
  const filters: FeedbackFilters = {
    from: params.get("from") || undefined, to: params.get("to") || undefined,
    rating: Number(params.get("rating")) || undefined,
    sentiment: (params.get("sentiment") || undefined) as SentimentLabel | undefined,
    category: (params.get("category") || undefined) as FeedbackCategory | undefined,
    channelId: params.get("channel") || undefined, songId: params.get("song") || undefined,
  };
  const [{ data }, { data: channels }, { data: songs }] = await Promise.all([
    supabase.from("feedback_submissions").select("*").order("created_at", { ascending: false }).limit(5000),
    supabase.from("channels").select("id, name"), supabase.from("songs").select("id, title"),
  ]);
  const channelName = new Map((channels ?? []).map((item) => [item.id, item.name]));
  const songName = new Map((songs ?? []).map((item) => [item.id, item.title]));
  const headers = ["Submitted at", "Rating", "Rating satisfaction", "Category", "Channel", "Song", "Comment", "AI sentiment", "Confidence", "Themes", "Sentiment status", "Admin override"];
  const body = filterFeedback((data ?? []) as DbFeedbackSubmission[], filters).map((row) => [row.created_at, row.rating, satisfactionFromRating(row.rating), row.category, channelName.get(row.channel_id ?? ""), songName.get(row.song_id ?? ""), row.comment, row.sentiment_label, row.sentiment_confidence, row.detected_themes?.join(" | "), row.sentiment_status, row.admin_sentiment_override].map(escapeCsv).join(","));
  const csv = [headers.map(escapeCsv).join(","), ...body].join("\r\n");
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="paatalavela-feedback-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
