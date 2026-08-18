"use client";

import { useEffect, useState } from "react";
import type { PublicSponsorCampaign } from "@/lib/sponsorship/types";

export function useSponsors() {
  const [campaigns, setCampaigns] = useState<PublicSponsorCampaign[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sponsors/active")
      .then((response) => (response.ok ? response.json() : { campaigns: [] }))
      .then((body: { campaigns?: PublicSponsorCampaign[] }) => {
        if (!cancelled) {
          setCampaigns(body.campaigns ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCampaigns([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return campaigns;
}
