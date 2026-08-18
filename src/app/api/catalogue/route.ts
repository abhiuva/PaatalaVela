import { NextResponse } from "next/server";
import { catalogueRepository } from "@/lib/catalogue/repository";

export async function GET() {
  const catalogue = await catalogueRepository.getActiveChannels();

  return NextResponse.json(catalogue, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
