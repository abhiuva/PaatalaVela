import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Noto_Sans_Telugu } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoTelugu = Noto_Sans_Telugu({
  variable: "--font-noto-telugu",
  subsets: ["telugu"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "Paatala Vela Telugu Radio",
  description: "A time-aware Telugu music radio MVP powered by the official YouTube IFrame Player API.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  keywords: ["Telugu music", "Telugu radio", "తెలుగు పాటలు", "scheduled radio", "YouTube music discovery"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Paatala Vela Telugu Radio",
    description: "A curated Telugu radio-style listening experience scheduled by India time.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Paatala Vela Telugu Radio",
    description: "Curated Telugu music by mood and India time.",
  },
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="te-IN"
      className={`${geistSans.variable} ${geistMono.variable} ${notoTelugu.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
