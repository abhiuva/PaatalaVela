"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/auth";
import type { SongRequestStatus } from "@/types/database";

export async function updateSongRequestAction(formData: FormData) {
  const context = await getAdminContext();
  const supabase = context.status === "ok" ? createServiceSupabaseClient() : null;
  if (!supabase) {
    return;
  }

  const requestId = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "new") as SongRequestStatus;
  await supabase.from("song_requests").update({ status, reviewed_at: status === "new" ? null : new Date().toISOString() }).eq("id", requestId);
  revalidatePath("/admin/song-requests");
}
