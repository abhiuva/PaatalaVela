import "server-only";

import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { PublicSponsorCampaign } from "@/lib/sponsorship/types";

type CampaignRow = {
  id: string;
  campaign_name: string;
  placement_type: PublicSponsorCampaign["placementType"];
  channel_id: string | null;
  headline: string;
  description: string | null;
  image_url: string | null;
  destination_url: string;
  priority: number;
  created_at: string;
  sponsors: {
    name: string;
    logo_url: string | null;
    active: boolean;
  } | null;
};

export async function getActiveSponsorCampaigns(): Promise<PublicSponsorCampaign[]> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return [];
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sponsor_campaigns")
    .select("id, campaign_name, placement_type, channel_id, headline, description, image_url, destination_url, priority, created_at, sponsors(name, logo_url, active)")
    .eq("status", "active")
    .lte("start_at", now)
    .gt("end_at", now)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as CampaignRow[])
    .filter((campaign) => campaign.sponsors?.active)
    .map((campaign) => ({
      id: campaign.id,
      sponsorName: campaign.sponsors?.name ?? "Sponsor",
      logoUrl: campaign.sponsors?.logo_url ?? null,
      campaignName: campaign.campaign_name,
      placementType: campaign.placement_type,
      channelId: campaign.channel_id,
      headline: campaign.headline,
      description: campaign.description,
      imageUrl: campaign.image_url,
      destinationUrl: campaign.destination_url,
      priority: campaign.priority,
      createdAt: campaign.created_at,
    }));
}
