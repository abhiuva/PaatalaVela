import { NextResponse } from "next/server";
import { catalogueRepository } from "@/lib/catalogue/repository";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Netlify-CDN-Cache-Control": "no-store",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await context.params;
  const result = await catalogueRepository.getChannelById(channelId);

  if (result.error === "invalid_id") {
    return NextResponse.json({ error: "Use a valid channel UUID.", code: "CATALOGUE_CHANNEL_ID_INVALID" }, { status: 400, headers: noStoreHeaders });
  }

  if (result.error === "not_found" || result.error === "invalid_channel") {
    return NextResponse.json({ error: "Channel was not found.", code: "CATALOGUE_CHANNEL_NOT_FOUND" }, { status: 404, headers: noStoreHeaders });
  }

  if (result.error) {
    return NextResponse.json({ error: "Unable to load channel.", code: "CATALOGUE_CHANNEL_LOAD_FAILED" }, { status: 503, headers: noStoreHeaders });
  }

  return NextResponse.json(
    { channel: result.channel, catalogueVersion: "v1", fetchedAt: new Date().toISOString() },
    { headers: noStoreHeaders },
  );
}
