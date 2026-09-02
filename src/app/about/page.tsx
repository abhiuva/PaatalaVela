import { BRAND } from "@/config/brand";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <article className="mx-auto max-w-3xl space-y-4 rounded-lg border border-white/15 bg-white/8 p-5">
        <h1 className="text-3xl font-black">About {BRAND.name}</h1>
        <p>{BRAND.name} is a curated music-discovery and radio-style experience. Scheduled Telugu stations change mood by India time, while language channels are available on demand.</p>
        <p>Each channel follows a deliberate editorial sequence. Scheduled Live Radio calculates where the playlist should be at the current Asia/Kolkata time, while Manual Channel mode lets listeners explore a channel sequentially.</p>
        <p>Playback runs through YouTube’s embedded player. This website does not download, store or host copyrighted audio or video.</p>
      </article>
    </main>
  );
}
