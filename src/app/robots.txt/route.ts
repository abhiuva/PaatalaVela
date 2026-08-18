import { NextResponse } from "next/server";

export function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return new NextResponse(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${siteUrl}/sitemap.xml\n`, {
    headers: { "content-type": "text/plain" },
  });
}
