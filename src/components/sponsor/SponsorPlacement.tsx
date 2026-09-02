"use client";

import { useEffect, useMemo, useRef } from "react";
import { ExternalLink } from "lucide-react";
import { selectSponsorCampaign } from "@/lib/sponsorship/selection";
import type { PublicSponsorCampaign } from "@/lib/sponsorship/types";
import type { SponsorPlacementType } from "@/types/database";
import { getOrCreateSessionId, trackEvent } from "@/lib/analytics/client";

type SponsorPlacementProps = {
  campaigns: PublicSponsorCampaign[];
  channelId: string;
  placementType: SponsorPlacementType;
};

export function SponsorPlacement({ campaigns, channelId, placementType }: SponsorPlacementProps) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const impressionSentRef = useRef<string | null>(null);
  const campaign = useMemo(() => selectSponsorCampaign({ campaigns, channelId, placementType }), [campaigns, channelId, placementType]);

  useEffect(() => {
    if (!campaign || !ref.current || impressionSentRef.current === campaign.id) {
      return;
    }

    let timer: number | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          timer = window.setTimeout(() => {
            impressionSentRef.current = campaign.id;
            trackEvent("sponsor_impression", {
              session_id: getOrCreateSessionId(),
              campaign_id: campaign.id,
              placement_type: placementType,
            });
          }, 1000);
        } else if (timer) {
          window.clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, 0.5, 1] },
    );

    observer.observe(ref.current);
    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
      observer.disconnect();
    };
  }, [campaign, placementType]);

  if (!campaign) {
    return null;
  }

  return (
    <a
      ref={ref}
      href={campaign.destinationUrl}
      target="_blank"
      rel="sponsored noopener noreferrer"
      onClick={() =>
        trackEvent("sponsor_clicked", {
          session_id: getOrCreateSessionId(),
          campaign_id: campaign.id,
          placement_type: placementType,
        })
      }
      className="block rounded-lg border border-white/18 bg-black/28 p-4 text-white shadow-xl shadow-black/20 backdrop-blur transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/55">Sponsored</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-black">{campaign.headline}</p>
          {campaign.description ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/70">{campaign.description}</p> : null}
          <p className="mt-2 text-xs text-white/58">Presented by {campaign.sponsorName}</p>
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-white/65" aria-hidden="true" />
      </div>
    </a>
  );
}
