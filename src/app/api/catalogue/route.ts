import { NextResponse } from "next/server";
import { catalogueRepository } from "@/lib/catalogue/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const catalogue = await catalogueRepository.getActiveChannels();

  return NextResponse.json(catalogue, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Netlify-CDN-Cache-Control": "no-store",
    },
  });
}
