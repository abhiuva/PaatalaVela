import { describe, expect, it } from "vitest";
import { selectSponsorCampaign, sponsorCtr } from "@/lib/sponsorship/selection";
import type { PublicSponsorCampaign } from "@/lib/sponsorship/types";

function campaign(overrides: Partial<PublicSponsorCampaign>): PublicSponsorCampaign {
  return {
    id: "campaign_1",
    sponsorName: "Sponsor",
    logoUrl: null,
    campaignName: "Campaign",
    placementType: "channel",
    channelId: null,
    headline: "Supported by Sponsor",
    description: null,
    imageUrl: null,
    destinationUrl: "https://example.com",
    priority: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("sponsor selection", () => {
  it("prefers channel-specific campaigns over homepage campaigns", () => {
    const selected = selectSponsorCampaign({
      channelId: "mass",
      campaigns: [
        campaign({ id: "home", placementType: "homepage", channelId: null, priority: 100 }),
        campaign({ id: "channel", placementType: "channel", channelId: "mass", priority: 0 }),
      ],
    });
    expect(selected?.id).toBe("channel");
  });

  it("uses priority and created_at as deterministic tie breakers", () => {
    const selected = selectSponsorCampaign({
      channelId: "mass",
      campaigns: [
        campaign({ id: "later", channelId: "mass", priority: 5, createdAt: "2026-01-02T00:00:00.000Z" }),
        campaign({ id: "earlier", channelId: "mass", priority: 5, createdAt: "2026-01-01T00:00:00.000Z" }),
      ],
    });
    expect(selected?.id).toBe("earlier");
  });

  it("does not render invalid destinations", () => {
    const selected = selectSponsorCampaign({ channelId: "mass", campaigns: [campaign({ destinationUrl: "http://bad.example" })] });
    expect(selected).toBeNull();
  });

  it("handles zero-impression CTR", () => {
    expect(sponsorCtr(10, 0)).toBe(0);
  });
});
