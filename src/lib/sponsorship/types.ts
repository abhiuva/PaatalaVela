import type { SponsorPlacementType } from "@/types/database";

export type PublicSponsorCampaign = {
  id: string;
  sponsorName: string;
  logoUrl: string | null;
  campaignName: string;
  placementType: SponsorPlacementType;
  channelId: string | null;
  headline: string;
  description: string | null;
  imageUrl: string | null;
  destinationUrl: string;
  priority: number;
  createdAt: string;
};
