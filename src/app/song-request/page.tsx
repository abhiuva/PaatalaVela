import { SongRequestForm } from "@/app/song-request/SongRequestForm";

export default function SongRequestPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto max-w-2xl rounded-lg border border-white/15 bg-white/8 p-5">
        <h1 className="text-3xl font-black">Request a Telugu song</h1>
        <p className="mt-2 text-white/70">Suggest a song for editorial review. Requests do not automatically publish songs or verify YouTube videos.</p>
        <div className="mt-6"><SongRequestForm /></div>
      </section>
    </main>
  );
}
