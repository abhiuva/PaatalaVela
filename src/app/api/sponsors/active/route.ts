import { NextResponse } from "next/server";
import { getActiveSponsorCampaigns } from "@/lib/sponsorship/repository";

export async function GET() {
  const campaigns = await getActiveSponsorCampaigns();
  return NextResponse.json(
    { campaigns },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
