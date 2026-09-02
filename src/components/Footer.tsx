import Link from "next/link";
import { ConsentSettings } from "@/components/privacy/ConsentSettings";
import { BRAND } from "@/config/brand";

export function Footer() {
  return (
    <footer className="mt-6 border-t border-white/15 py-6 text-xs leading-5 text-white/62">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="grid gap-5 sm:grid-cols-2">
          <section aria-labelledby="footer-product">
            <h2 id="footer-product" className="text-sm font-black text-white">Curated Telugu radio by mood and time</h2>
            <p className="mt-2 max-w-md">{BRAND.name} follows India time with editorially ordered music and on-demand language channels.</p>
          </section>
          <section aria-labelledby="footer-rights">
            <h2 id="footer-rights" className="text-sm font-black text-white">Playback and rights</h2>
            <p className="mt-2 max-w-md">Playback uses the official YouTube IFrame Player API. We do not download, store or host copyrighted audio or video.</p>
            <Link href="/takedown" className="mt-2 inline-block font-bold text-white/80 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-white">Submit a takedown request</Link>
          </section>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 sm:col-span-2" aria-label="Footer links">
            {[['/about','About'],['/privacy','Privacy'],['/terms','Terms'],['/rights-and-takedown','Rights'],['/song-request','Request a song']].map(([href, label]) => (
              <Link key={href} href={href} className="min-h-8 py-1 font-semibold text-white/78 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-white">{label}</Link>
            ))}
          </nav>
          <p className="sm:col-span-2">Channel and volume preferences stay in this browser. YouTube controls playback availability, ads and rights handling.</p>
        </div>
        <ConsentSettings />
      </div>
    </footer>
  );
}
