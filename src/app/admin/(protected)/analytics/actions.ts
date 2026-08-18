"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/admin/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { analyseStoredFeedback } from "@/lib/feedback/service";
import type { SentimentLabel } from "@/types/database";

async function requireAdministrator() {
  const context = await getAdminContext();
  if (context.status !== "ok" || context.profile.role !== "admin") throw new Error("Administrator access required.");
  const supabase = createServiceSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function reanalyseFeedbackAction(formData: FormData) {
  const supabase = await requireAdministrator();
  const id = String(formData.get("id") ?? "");
  const { data } = await supabase.from("feedback_submissions").select("id, comment").eq("id", id).maybeSingle();
  if (!data?.comment) return;
  await analyseStoredFeedback(supabase, data.id, data.comment);
  revalidatePath("/admin/analytics");
}

export async function overrideSentimentAction(formData: FormData) {
  const supabase = await requireAdministrator();
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("sentiment") ?? "");
  const allowed: SentimentLabel[] = ["positive", "neutral", "negative", "mixed"];
  const override = allowed.includes(raw as SentimentLabel) ? raw as SentimentLabel : null;
  const { data } = await supabase.from("feedback_submissions").select("sentiment_label, comment").eq("id", id).maybeSingle();
  if (!data) return;
  await supabase.from("feedback_submissions").update({
    admin_sentiment_override: override,
    sentiment_status: override ? "manually_reviewed" : data.sentiment_label ? "completed" : data.comment ? "pending" : "completed",
  }).eq("id", id);
  revalidatePath("/admin/analytics");
}

export async function analysePendingFeedbackAction() {
  const supabase = await requireAdministrator();
  const { data } = await supabase.from("feedback_submissions").select("id, comment").in("sentiment_status", ["pending", "failed"]).not("comment", "is", null).limit(50);
  for (const row of data ?? []) await analyseStoredFeedback(supabase, row.id, row.comment!);
  revalidatePath("/admin/analytics");
}

export async function sendTestAnalyticsEventAction() {
  const supabase = await requireAdministrator();
  const payload = {
    anonymous_session_id: "admin_health_test",
    event_name: "schedule_viewed",
    properties: { is_test: true, source: "admin_analytics_health" },
    is_test: true,
  } as const;
  const { error } = await supabase.from("listening_events").insert(payload);
  if (error?.code === "PGRST204") {
    await supabase.from("listening_events").insert({
      anonymous_session_id: payload.anonymous_session_id,
      event_name: payload.event_name,
      properties: payload.properties,
    });
  }
  revalidatePath("/admin/analytics");
}
