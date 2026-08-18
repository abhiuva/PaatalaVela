import { RadioPlayer } from "@/components/RadioPlayer";

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
            name: "Paatala Vela Telugu Radio",
            url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
            publisher: {
              "@type": "Organization",
              name: "Paatala Vela",
            },
          }),
        }}
      />
      <RadioPlayer />
    </>
  );
}
