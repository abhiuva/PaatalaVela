import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { songRequestInputSchema } from "@/lib/catalogue/validation";

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function limited(key: string) {
  const now = Date.now();
  const bucket = rateLimit.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 5;
}

export async function POST(request: Request) {
  if (limited(clientKey(request))) {
    return NextResponse.json({ ok: false, message: "Too many song requests." }, { status: 429 });
  }

  const formData = await request.formData();
  const parsed = songRequestInputSchema.safeParse({
    songName: formData.get("songName"),
    filmName: formData.get("filmName"),
    singer: formData.get("singer"),
    youtubeUrl: formData.get("youtubeUrl"),
    requestedChannelId: formData.get("requestedChannelId"),
    reason: formData.get("reason"),
    company: formData.get("company") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Song requests are not configured yet." }, { status: 503 });
  }

  const { data: channel } = await supabase.from("channels").select("id").eq("slug", parsed.data.requestedChannelId).maybeSingle();
  if (!channel) {
    return NextResponse.json({ ok: false, message: "Requested channel is unavailable." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("song_requests")
    .insert({
      song_name: parsed.data.songName.replace(/[<>]/g, ""),
      film_name: parsed.data.filmName.replace(/[<>]/g, ""),
      singer: parsed.data.singer?.replace(/[<>]/g, "") || null,
      youtube_url: parsed.data.youtubeUrl,
      requested_channel_id: channel.id,
      reason: parsed.data.reason?.replace(/[<>]/g, "") || null,
      status: "new",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "Unable to store request." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reference: data.id.slice(0, 8).toUpperCase(), channelId: channel.id });
}
