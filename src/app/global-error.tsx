"use client";

import { BRAND } from "@/config/brand";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-neutral-950 px-4 text-white">
        <main className="max-w-lg text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/55">{BRAND.name}</p>
          <h1 className="mt-3 text-4xl font-black">Playback page unavailable</h1>
          <p className="mt-3 text-white/70">{BRAND.name} could not load this view.</p>
          <button type="button" onClick={reset} className="mt-6 rounded-md border border-white/25 px-4 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-white">Try again</button>
        </main>
      </body>
    </html>
  );
}
