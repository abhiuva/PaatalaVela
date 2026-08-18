import Link from "next/link";
import { TakedownForm } from "@/app/takedown/TakedownForm";

export default function TakedownPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto max-w-2xl rounded-lg border border-white/15 bg-white/8 p-5 shadow-2xl shadow-black/30">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/60">Rights request</p>
        <h1 className="mt-3 text-3xl font-black">Takedown request</h1>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Use this form to report a catalogue item that should be reviewed. Submitted requests are stored privately for administrators.
        </p>
        <div className="mt-6">
          <TakedownForm />
        </div>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-white/70 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-white">
          Back to radio
        </Link>
      </section>
    </main>
  );
}
