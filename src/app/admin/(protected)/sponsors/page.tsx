import { ActionStateForm } from "@/components/admin/ActionStateForm";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { saveCampaignAction, saveSponsorAction } from "@/app/admin/(protected)/sponsors/actions";
import { sponsorCtr } from "@/lib/sponsorship/selection";

export default async function AdminSponsorsPage() {
  const supabase = createServiceSupabaseClient();
  const [sponsors, campaigns, metrics, channels] = await Promise.all([
    supabase?.from("sponsors").select("*").order("created_at", { ascending: false }),
    supabase?.from("sponsor_campaigns").select("*").order("created_at", { ascending: false }),
    supabase?.from("daily_sponsor_metrics").select("*"),
    supabase?.from("channels").select("id, name").order("display_order", { ascending: true }),
  ]);

  const sponsorRows = sponsors?.data ?? [];
  const campaignRows = campaigns?.data ?? [];
  const metricRows = metrics?.data ?? [];
  const channelRows = channels?.data ?? [];

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <h1 className="text-3xl font-black">Sponsors</h1>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/8 p-4">
          <h2 className="text-xl font-black">Add sponsor</h2>
          <ActionStateForm action={saveSponsorAction} submitLabel="Save sponsor">
            <label className="block text-sm text-white/75">Name<input name="name" required className="mt-1 w-full rounded-md bg-black/25 px-3 py-2" /></label>
            <label className="block text-sm text-white/75">Website HTTPS URL<input name="websiteUrl" type="url" required className="mt-1 w-full rounded-md bg-black/25 px-3 py-2" /></label>
            <label className="block text-sm text-white/75">Logo URL<input name="logoUrl" type="url" className="mt-1 w-full rounded-md bg-black/25 px-3 py-2" /></label>
            <label className="block text-sm text-white/75">Contact name<input name="contactName" className="mt-1 w-full rounded-md bg-black/25 px-3 py-2" /></label>
            <label className="block text-sm text-white/75">Contact email<input name="contactEmail" type="email" className="mt-1 w-full rounded-md bg-black/25 px-3 py-2" /></label>
            <label className="flex items-center gap-2 text-sm text-white/75"><input name="active" type="checkbox" defaultChecked /> Active</label>
          </ActionStateForm>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/8 p-4">
          <h2 className="text-xl font-black">Add campaign</h2>
          <ActionStateForm action={saveCampaignAction} submitLabel="Save campaign">
            <select name="sponsorId" required className="w-full rounded-md bg-black/25 px-3 py-2">
              <option value="">Sponsor</option>
              {sponsorRows.map((sponsor) => <option key={sponsor.id} value={sponsor.id}>{sponsor.name}</option>)}
            </select>
            <input name="campaignName" required placeholder="Campaign name" className="w-full rounded-md bg-black/25 px-3 py-2" />
            <select name="placementType" required className="w-full rounded-md bg-black/25 px-3 py-2">
              {["homepage", "channel", "now_playing", "schedule", "footer"].map((placement) => <option key={placement}>{placement}</option>)}
            </select>
            <select name="channelId" className="w-full rounded-md bg-black/25 px-3 py-2">
              <option value="">No channel target</option>
              {channelRows.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
            </select>
            <input name="headline" required placeholder="Headline" className="w-full rounded-md bg-black/25 px-3 py-2" />
            <textarea name="description" placeholder="Description" className="w-full rounded-md bg-black/25 px-3 py-2" />
            <input name="destinationUrl" required type="url" placeholder="Destination HTTPS URL" className="w-full rounded-md bg-black/25 px-3 py-2" />
            <input name="imageUrl" type="url" placeholder="Image URL" className="w-full rounded-md bg-black/25 px-3 py-2" />
            <div className="grid grid-cols-2 gap-2">
              <input name="startAt" required type="datetime-local" className="w-full rounded-md bg-black/25 px-3 py-2" />
              <input name="endAt" required type="datetime-local" className="w-full rounded-md bg-black/25 px-3 py-2" />
            </div>
            <input name="priority" type="number" defaultValue="0" min="0" className="w-full rounded-md bg-black/25 px-3 py-2" />
            <select name="status" defaultValue="draft" className="w-full rounded-md bg-black/25 px-3 py-2">
              {["draft", "scheduled", "active", "paused", "completed"].map((status) => <option key={status}>{status}</option>)}
            </select>
          </ActionStateForm>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/8 p-4">
        <h2 className="text-xl font-black">Campaigns</h2>
        <div className="mt-4 overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-white/55"><tr><th className="p-2">Campaign</th><th className="p-2">Status</th><th className="p-2">Placement</th><th className="p-2">Warnings</th><th className="p-2">CTR</th></tr></thead>
            <tbody>
              {campaignRows.map((campaign) => {
                const totals = metricRows.filter((metric) => metric.campaign_id === campaign.id).reduce((acc, metric) => ({ impressions: acc.impressions + metric.impressions, clicks: acc.clicks + metric.clicks }), { impressions: 0, clicks: 0 });
                const warnings = [
                  campaign.image_url ? null : "Missing logo/image",
                  campaign.destination_url.startsWith("https://") ? null : "Invalid destination URL",
                  new Date(campaign.end_at) < new Date() ? "Expired campaign" : null,
                  !campaign.start_at || !campaign.end_at ? "Active campaign without dates" : null,
                ].filter(Boolean).join(", ");
                return (
                  <tr key={campaign.id} className="border-t border-white/10">
                    <td className="p-2">{campaign.campaign_name}<p className="text-white/55">{campaign.headline}</p></td>
                    <td className="p-2">{campaign.status}</td>
                    <td className="p-2">{campaign.placement_type}</td>
                    <td className="p-2 text-amber-100">{warnings || "None"}</td>
                    <td className="p-2">{(sponsorCtr(totals.clicks, totals.impressions) * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
