import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    name: "Paatala Vela Telugu Radio",
    short_name: "Paatala Vela",
    start_url: "/",
    display: "standalone",
    background_color: "#070707",
    theme_color: "#f2b705",
    description: "A scheduled Telugu music radio experience powered by YouTube embeds.",
  });
}
