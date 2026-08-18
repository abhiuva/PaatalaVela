import { NextResponse } from "next/server";

export function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const paths = ["", "/about", "/privacy", "/terms", "/rights-and-takedown", "/song-request", "/takedown"];
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths
      .map((path) => `<url><loc>${siteUrl}${path}</loc></url>`)
      .join("")}</urlset>`,
    { headers: { "content-type": "application/xml" } },
  );
}
