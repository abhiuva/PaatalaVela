import { RadioPlayer } from "@/components/RadioPlayer";
import { BRAND } from "@/config/brand";

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: BRAND.name,
            url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
            publisher: {
              "@type": "Organization",
              name: BRAND.name,
            },
          }),
        }}
      />
      <RadioPlayer />
    </>
  );
}
