import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getScheduledChannel } from "@/lib/schedule";
import { channels as localChannels } from "@/data/channels";

export default async function AdminHealthPage() {
  const supabase = createServiceSupabaseClient();
  const [channels, songs, campaigns] = await Promise.all([
    supabase?.from("channels").select("id, slug, name, active").eq("active", true),
    supabase?.from("songs").select("id, active, embed_status, duration_seconds"),
    supabase?.from("sponsor_campaigns").select("id, headline, status, start_at, end_at").eq("status", "active"),
  ]);
  const songRows = songs?.data ?? [];
  const missingDuration = songRows.filter((song) => song.active && (!song.duration_seconds || song.duration_seconds <= 0)).length;
  const unavailable = songRows.filter((song) => ["unavailable", "embedding_disabled", "region_restricted"].includes(song.embed_status)).length;
  const scheduled = getScheduledChannel(new Date(), localChannels);
  const activeCampaign = (campaigns?.data ?? []).find((campaign) => new Date(campaign.start_at) <= new Date() && new Date(campaign.end_at) > new Date());

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-3xl font-black">Health</h1>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Supabase connection", supabase ? "configured" : "not configured"],
          ["Active channels", channels?.data?.length ?? 0],
          ["Channels with zero playable songs", "review assignments"],
          ["Songs missing duration", missingDuration],
          ["Songs unavailable", unavailable],
          ["Last successful catalogue load", "runtime cached"],
          ["Analytics ingestion", supabase ? "configured" : "no-op"],
          ["Active sponsor campaign", activeCampaign?.headline ?? "none"],
          ["Current scheduled channel IST", scheduled.name],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-white/10 bg-white/8 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-white/55">{label}</p>
            <p className="mt-2 text-xl font-black">{value}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
