import { NextResponse } from "next/server";
import { BRAND } from "@/config/brand";

export function GET() {
  return NextResponse.json({
    name: BRAND.name,
    short_name: BRAND.shortName,
    start_url: "/",
    display: "standalone",
    background_color: "#070707",
    theme_color: "#f2b705",
    description: BRAND.description,
  });
}
