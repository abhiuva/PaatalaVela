import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { extractYouTubeVideoId, takedownInputSchema } from "@/lib/catalogue/validation";

function clean(value: string) {
  return value.replace(/[<>]/g, "").trim();
}

export async function POST(request: Request) {
  const body = await request.formData();
  const parsed = takedownInputSchema.safeParse({
    songOrYoutubeUrl: body.get("songOrYoutubeUrl"),
    claimantName: body.get("claimantName"),
    claimantEmail: body.get("claimantEmail"),
    rightsHolder: body.get("rightsHolder"),
    requestDetails: body.get("requestDetails"),
    evidenceUrl: body.get("evidenceUrl"),
    confirmation: body.get("confirmation"),
    company: body.get("company") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid submission." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Takedown submissions are not configured yet." }, { status: 503 });
  }

  const youtubeVideoId = extractYouTubeVideoId(parsed.data.songOrYoutubeUrl);
  let songId: string | null = null;

  if (youtubeVideoId) {
    const { data: song } = await supabase.from("songs").select("id").eq("youtube_video_id", youtubeVideoId).maybeSingle();
    songId = song?.id ?? null;
  }

  const { data, error } = await supabase
    .from("takedown_requests")
    .insert({
      song_id: songId,
      claimant_name: clean(parsed.data.claimantName),
      claimant_email: parsed.data.claimantEmail.toLowerCase(),
      rights_holder: clean(parsed.data.rightsHolder),
      request_details: clean(parsed.data.requestDetails),
      evidence_url: parsed.data.evidenceUrl,
      status: "new",
      internal_notes: null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "Unable to submit the request." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reference: data.id.slice(0, 8).toUpperCase() });
}
