import type { PublicSponsorCampaign } from "@/lib/sponsorship/types";
import type { SponsorPlacementType } from "@/types/database";

export function isRenderableCampaign(campaign: PublicSponsorCampaign, now: Date) {
  void now;
  return Boolean(campaign.destinationUrl.startsWith("https://") && campaign.headline.trim());
}

export function selectSponsorCampaign({
  campaigns,
  channelId,
  placementType,
  now = new Date(),
}: {
  campaigns: readonly PublicSponsorCampaign[];
  channelId: string;
  placementType?: SponsorPlacementType;
  now?: Date;
}) {
  return campaigns
    .filter((campaign) => isRenderableCampaign(campaign, now))
    .filter((campaign) => !placementType || campaign.placementType === placementType)
    .filter((campaign) => campaign.channelId === channelId || campaign.channelId === null)
    .sort((a, b) => {
      const aChannel = a.channelId === channelId ? 0 : 1;
      const bChannel = b.channelId === channelId ? 0 : 1;
      return aChannel - bChannel || b.priority - a.priority || a.createdAt.localeCompare(b.createdAt);
    })[0] ?? null;
}

export function sponsorCtr(clicks: number, impressions: number) {
  if (impressions <= 0) {
    return 0;
  }
  return clicks / impressions;
}
